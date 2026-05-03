"""Слушатель удалений в @UG_DRIVER через Telethon updates.
Экономный: спит до события, при удалении — обрабатывает.

GET                         — статус
POST ?action=settings       — обновить шаблон/enabled (старт/стоп слушателя)
POST ?action=run            — одноразовый запуск (опрос AdminLog за всё с last_id)
POST ?action=loop           — слушатель updates 24/7 (просыпается только на удаления)
GET  ?action=history        — история отправок
"""
import os
import json
import re
import time
import hashlib
import asyncio
import threading
import urllib.request
import psycopg2

from telethon import TelegramClient, events
from telethon.sessions import StringSession
from telethon.errors import FloodWaitError
from telethon.tl.functions.channels import GetAdminLogRequest
from telethon.tl.types import (
    ChannelAdminLogEventsFilter,
    ChannelAdminLogEventActionDeleteMessage,
    ChannelAdminLogEventActionParticipantToggleBan,
    ChatBannedRights,
)

SELF_URL = 'https://functions.poehali.dev/2db8bbe3-c6b3-4bda-866c-c22a8c621520'
LOOP_DURATION_SEC = 25  # макс время одного запуска (укладываемся в таймаут 30)
LOOP_PAUSE_SEC = 180  # пауза между циклами (3 мин) — экономия compute: 25/(25+180) ≈ 12% от 24/7
                       # При лимите 80ч/28дней даёт ~73ч расхода — укладываемся
HEARTBEAT_EVERY_SEC = 10  # как часто обновлять heartbeat в БД
DELETER_BOT_USERNAMES = {'vsyarussiabot', 'ugtransferbot'}  # боты-удалятели (нижний регистр)

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
}
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')
TARGET_GROUP = '@UG_DRIVER'
DELETER_BOT = 'VsyaRussiabot'  # без @


def verify_token(token: str) -> bool:
    admin_login = os.environ.get('ADMIN_LOGIN', '')
    admin_password = os.environ.get('ADMIN_PASSWORD', '')
    base = f"{admin_login}:{admin_password}:admin_secret_2026"
    return token == hashlib.sha256(base.encode()).hexdigest()


def esc(s) -> str:
    return str(s or '').replace("'", "''")


def resp(status: int, body: dict) -> dict:
    return {'statusCode': status, 'headers': CORS, 'body': json.dumps(body, default=str)}


def db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def get_settings() -> dict:
    conn = db(); cur = conn.cursor()
    cur.execute(f"SELECT enabled, message_template, last_checked_msg_id, last_run_at, loop_token, loop_heartbeat FROM {SCHEMA}.excluded_settings WHERE id=1")
    r = cur.fetchone()
    cur.close(); conn.close()
    if not r:
        return {'enabled': False, 'message_template': '', 'last_checked_msg_id': 0, 'last_run_at': None, 'loop_token': None, 'loop_heartbeat': None}
    return {
        'enabled': r[0], 'message_template': r[1], 'last_checked_msg_id': int(r[2] or 0),
        'last_run_at': r[3], 'loop_token': r[4], 'loop_heartbeat': r[5],
    }


def set_loop_token(token: str):
    conn = db(); cur = conn.cursor()
    cur.execute(f"UPDATE {SCHEMA}.excluded_settings SET loop_token='{esc(token)}', loop_heartbeat=NOW() WHERE id=1")
    conn.commit(); cur.close(); conn.close()


def heartbeat():
    conn = db(); cur = conn.cursor()
    cur.execute(f"UPDATE {SCHEMA}.excluded_settings SET loop_heartbeat=NOW() WHERE id=1")
    conn.commit(); cur.close(); conn.close()


def fire_self_loop(token: str, delay_sec: int = 0):
    """Запускает себя же в фоне (POST ?action=loop) и сразу возвращается.
    delay_sec — пауза перед запуском следующего цикла (экономия compute)."""
    def _go():
        try:
            if delay_sec > 0:
                time.sleep(delay_sec)
            # Перед стартом проверяем что цикл всё ещё актуален
            try:
                conn = db(); cur = conn.cursor()
                cur.execute(f"SELECT enabled, loop_token FROM {SCHEMA}.excluded_settings WHERE id=1")
                r = cur.fetchone(); cur.close(); conn.close()
                if not r or not r[0] or r[1] != token:
                    return  # выключен или токен сменился
            except Exception:
                pass
            req = urllib.request.Request(
                f"{SELF_URL}?action=loop",
                data=json.dumps({'token': token}).encode(),
                headers={'Content-Type': 'application/json'},
                method='POST',
            )
            urllib.request.urlopen(req, timeout=3)
        except Exception:
            pass
    threading.Thread(target=_go, daemon=True).start()


def save_settings(enabled=None, template=None, last_msg_id=None):
    parts = []
    if enabled is not None:
        parts.append(f"enabled={'TRUE' if enabled else 'FALSE'}")
    if template is not None:
        parts.append(f"message_template='{esc(template)}'")
    if last_msg_id is not None:
        parts.append(f"last_checked_msg_id={int(last_msg_id)}")
        parts.append(f"last_run_at=NOW()")
    if not parts:
        return
    conn = db(); cur = conn.cursor()
    cur.execute(f"UPDATE {SCHEMA}.excluded_settings SET {', '.join(parts)} WHERE id=1")
    conn.commit(); cur.close(); conn.close()


def get_session2() -> str:
    conn = db(); cur = conn.cursor()
    cur.execute(f"SELECT session_string FROM {SCHEMA}.tg_user_session2 WHERE id=1 AND logged_in=TRUE")
    r = cur.fetchone()
    cur.close(); conn.close()
    return r[0] if r else ''


def already_sent(user_id: int) -> bool:
    conn = db(); cur = conn.cursor()
    cur.execute(f"SELECT 1 FROM {SCHEMA}.excluded_drivers WHERE user_id={int(user_id)} AND message_sent=TRUE LIMIT 1")
    r = cur.fetchone()
    cur.close(); conn.close()
    return r is not None


def log_send(user_id, username, first_name, source_msg_id, status: str):
    conn = db(); cur = conn.cursor()
    cur.execute(
        f"INSERT INTO {SCHEMA}.excluded_drivers (user_id, username, first_name, source_msg_id, message_sent, message_sent_at, send_status) "
        f"VALUES ({int(user_id) if user_id else 0}, '{esc(username)}', '{esc(first_name)}', "
        f"{int(source_msg_id) if source_msg_id else 0}, {'TRUE' if status == 'ok' else 'FALSE'}, NOW(), '{esc(status)}')"
    )
    conn.commit(); cur.close(); conn.close()


async def run_scan() -> dict:
    """Сканирует @UG_DRIVER на сервисные сообщения от @VsyaRussiabot и шлёт ЛС."""
    settings = get_settings()
    if not settings['enabled']:
        return {'ok': False, 'reason': 'disabled'}

    session_str = get_session2()
    if not session_str:
        return {'ok': False, 'reason': 'not_logged_in', 'error': 'Залогинь второй аккаунт'}

    api_id = int(os.environ['TG_API_ID'])
    api_hash = os.environ['TG_API_HASH']
    template = settings['message_template'] or 'Здравствуйте!'
    last_id = settings['last_checked_msg_id']

    sent_count = 0
    new_last_id = last_id
    found = []
    errors = []

    client = TelegramClient(StringSession(session_str), api_id, api_hash)
    await client.connect()
    try:
        try:
            entity = await client.get_entity(TARGET_GROUP)
        except Exception as e:
            return {'ok': False, 'error': f'нет доступа к {TARGET_GROUP}: {e}'}

        # Читаем АДМИН-ЛОГ группы — фильтруем строго по @VsyaRussiabot (admins=[bot])
        # КРИТИЧНО: без admins=[bot] действия ботов СКРЫТЫ в AdminLog Telegram!
        bot_entity = None
        try:
            bot_entity = await client.get_entity(DELETER_BOT)
        except Exception as e:
            return {'ok': False, 'error': f'cannot resolve {DELETER_BOT}: {e}'}

        try:
            admin_log = await client(GetAdminLogRequest(
                channel=entity,
                q='',
                events_filter=ChannelAdminLogEventsFilter(
                    delete=True, kick=True, ban=True,
                ),
                admins=[bot_entity],  # !! фильтр по конкретному боту
                max_id=0,
                min_id=last_id,
                limit=100,
            ))
        except Exception as e:
            return {'ok': False, 'error': f'AdminLog недоступен (аккаунт должен быть админом): {e}'}

        events = list(admin_log.events)
        events.sort(key=lambda e: e.id)

        users_cache = {u.id: u for u in admin_log.users}
        deleter_bot_ids = {bot_entity.id}

        for ev in events:
            if ev.id > new_last_id:
                new_last_id = ev.id
            action = ev.action

            author_id = None

            # Тип 1: бот удалил сообщение
            if isinstance(action, ChannelAdminLogEventActionDeleteMessage):
                if deleter_bot_ids and ev.user_id not in deleter_bot_ids:
                    print(f"[adminlog] skip delete event={ev.id} deleter_id={ev.user_id} (not VsyaRussiabot)")
                    continue
                deleted = action.message
                if hasattr(deleted, 'from_id') and deleted.from_id:
                    author_id = getattr(deleted.from_id, 'user_id', None)

            # Тип 2: бот ограничил права (ban) — основной триггер для @VsyaRussiabot
            elif isinstance(action, ChannelAdminLogEventActionParticipantToggleBan):
                if deleter_bot_ids and ev.user_id not in deleter_bot_ids:
                    continue
                # Проверяем что это именно ограничение (а не разбан)
                new_p = getattr(action, 'new_participant', None)
                br = getattr(new_p, 'banned_rights', None) if new_p else None
                # Если send_messages=True значит ЗАПРЕЩЕНО писать (Telegram использует инверсную логику)
                if not br or not getattr(br, 'send_messages', False):
                    continue
                # Достаём ID забаненного
                peer = getattr(new_p, 'peer', None)
                author_id = getattr(peer, 'user_id', None) if peer else None
                print(f"[adminlog] BAN event={ev.id} bot_id={ev.user_id} target_user={author_id}")
            else:
                continue

            if not author_id:
                print(f"[adminlog] event={ev.id} no author")
                continue

            user = users_cache.get(author_id)
            if not user:
                try:
                    user = await client.get_entity(author_id)
                except Exception as e:
                    print(f"[adminlog] event={ev.id} get_entity failed: {e}")
                    continue

            username = getattr(user, 'username', '') or ''
            first_name = getattr(user, 'first_name', '') or 'водитель'
            is_bot = getattr(user, 'bot', False)

            print(f"[adminlog] event={ev.id} deleted_author=@{username} (id={author_id}, name={first_name}, bot={is_bot})")

            if is_bot:
                continue  # ботам не пишем

            if already_sent(author_id):
                continue

            personalized = template.replace('{name}', first_name).replace('{username}', username or '')
            try:
                await client.send_message(author_id, personalized)
                log_send(author_id, username, first_name, ev.id, 'ok')
                sent_count += 1
                found.append({'user_id': author_id, 'username': username, 'first_name': first_name, 'event_id': ev.id})
            except FloodWaitError as fe:
                log_send(author_id, username, first_name, ev.id, f'flood:{fe.seconds}')
                errors.append({'event_id': ev.id, 'reason': f'flood {fe.seconds}s'})
                break
            except Exception as e:
                log_send(author_id, username, first_name, ev.id, f'err:{str(e)[:200]}')
                errors.append({'event_id': ev.id, 'reason': str(e)[:200]})

        if new_last_id > last_id:
            save_settings(last_msg_id=new_last_id)
        return {'ok': True, 'sent': sent_count, 'found': found, 'errors': errors, 'events_total': len(events), 'last_event_id': new_last_id}
    finally:
        try:
            await client.disconnect()
        except Exception:
            pass


async def process_deletion_message(client, msg, template: str) -> dict:
    """Обрабатывает сообщение от бота-удалятора, шлёт ЛС автору удалённого сообщения."""
    text = (msg.text or msg.message or '')
    if not text:
        return {'ok': False, 'reason': 'empty_text'}

    # Триггер: "удалил(а)... от ИМЯ:" или просто факт удаления с reply
    if not msg.reply_to_msg_id:
        # без reply не знаем автора
        return {'ok': False, 'reason': 'no_reply'}

    # Берём автора удалённого сообщения через reply
    try:
        reply = await client.get_messages(msg.peer_id, ids=msg.reply_to_msg_id)
    except Exception as e:
        return {'ok': False, 'reason': f'get_reply: {e}'}

    if not reply or not getattr(reply, 'sender_id', None):
        return {'ok': False, 'reason': 'no_reply_sender'}

    user_id = reply.sender_id
    try:
        u = await reply.get_sender()
    except Exception:
        u = None
    username = (getattr(u, 'username', '') or '') if u else ''
    first_name = (getattr(u, 'first_name', '') or '') if u else 'водитель'
    is_bot = getattr(u, 'bot', False) if u else False

    if is_bot:
        return {'ok': False, 'reason': 'is_bot'}
    if already_sent(user_id):
        return {'ok': False, 'reason': 'already_sent'}

    personalized = template.replace('{name}', first_name).replace('{username}', username or '')
    try:
        await client.send_message(user_id, personalized)
        log_send(user_id, username, first_name, msg.id, 'ok')
        return {'ok': True, 'user_id': user_id, 'username': username}
    except FloodWaitError as fe:
        log_send(user_id, username, first_name, msg.id, f'flood:{fe.seconds}')
        return {'ok': False, 'reason': f'flood:{fe.seconds}'}
    except Exception as e:
        log_send(user_id, username, first_name, msg.id, f'err:{str(e)[:200]}')
        return {'ok': False, 'reason': str(e)[:200]}


async def run_listener(loop_token: str) -> dict:
    """Event-driven listener: спит до прихода update, при удалении — шлёт ЛС.
    Работает 25 секунд, потом возвращает результат (handler перезапускает себя)."""
    settings = get_settings()
    if not settings['enabled']:
        return {'ok': False, 'reason': 'disabled'}

    session_str = get_session2()
    if not session_str:
        return {'ok': False, 'reason': 'not_logged_in'}

    api_id = int(os.environ['TG_API_ID'])
    api_hash = os.environ['TG_API_HASH']
    template = settings['message_template'] or 'Здравствуйте!'

    try:
        target_entity = None
        target_chat_id = None
        client = TelegramClient(StringSession(session_str), api_id, api_hash)
        await client.connect()

        # Получаем ID целевой группы один раз
        try:
            target_entity = await client.get_entity(TARGET_GROUP)
            target_chat_id = target_entity.id
        except Exception as e:
            await client.disconnect()
            return {'ok': False, 'reason': f'no_access_to_group: {e}'}

        sent_count = [0]
        events_seen = [0]

        @client.on(events.NewMessage(chats=target_entity))
        async def handler_new_msg(ev):
            events_seen[0] += 1
            try:
                # Проверяем что отправитель — бот-удалятор
                sender = await ev.get_sender() if ev.sender_id else None
                sender_username = (getattr(sender, 'username', '') or '').lower() if sender else ''
                if sender_username not in DELETER_BOT_USERNAMES:
                    return
                # Проверяем что это сообщение про удаление
                text = (ev.raw_text or '')
                if not re.search(r'удалил|deleted', text, re.IGNORECASE):
                    return
                print(f"[listener] DELETE-MSG from @{sender_username}: {text[:120]!r}")
                res = await process_deletion_message(client, ev.message, template)
                if res.get('ok'):
                    sent_count[0] += 1
                    print(f"[listener] sent to user_id={res.get('user_id')} @{res.get('username')}")
                else:
                    print(f"[listener] skip: {res.get('reason')}")
            except Exception as e:
                print(f"[listener handler err] {e}")

        # Слушаем 25 секунд (или пока loop_token не сменился).
        # В конце — один раз опрашиваем AdminLog (надёжный fallback).
        start = time.time()
        last_hb = 0
        try:
            while time.time() - start < LOOP_DURATION_SEC:
                if time.time() - last_hb > HEARTBEAT_EVERY_SEC:
                    cur_s = get_settings()
                    if not cur_s['enabled'] or cur_s['loop_token'] != loop_token:
                        break
                    heartbeat()
                    last_hb = time.time()
                await asyncio.sleep(2)

            # Fallback: опрос AdminLog (один раз за цикл).
            # Ловим и удаления (delete) и баны/restrict (kick+ban) — @VsyaRussiabot работает через restrict
            adminlog_sent = 0
            try:
                cur_s = get_settings()
                last_id = cur_s['last_checked_msg_id']
                # КРИТИЧНО: admins=[bot] — иначе AdminLog скрывает действия ботов
                try:
                    bot_entity = await client.get_entity(DELETER_BOT)
                except Exception as _e:
                    print(f"[adminlog-poll] cannot resolve {DELETER_BOT}: {_e}")
                    bot_entity = None
                if not bot_entity:
                    raise Exception('no bot entity')
                admin_log = await client(GetAdminLogRequest(
                    channel=target_entity, q='',
                    events_filter=ChannelAdminLogEventsFilter(delete=True, kick=True, ban=True),
                    admins=[bot_entity], max_id=0, min_id=last_id, limit=50,
                ))
                ev_list = sorted(admin_log.events, key=lambda e: e.id)
                users_cache = {u.id: u for u in admin_log.users}
                deleter_bot_ids = {bot_entity.id}
                new_max = last_id
                for ev in ev_list:
                    if ev.id > new_max:
                        new_max = ev.id
                    author_id = None
                    # Тип 1: удаление сообщения
                    if isinstance(ev.action, ChannelAdminLogEventActionDeleteMessage):
                        if deleter_bot_ids and ev.user_id not in deleter_bot_ids:
                            continue
                        deleted = ev.action.message
                        from_id = getattr(deleted, 'from_id', None)
                        author_id = getattr(from_id, 'user_id', None) if from_id else None
                    # Тип 2: бан/restrict от @VsyaRussiabot
                    elif isinstance(ev.action, ChannelAdminLogEventActionParticipantToggleBan):
                        if deleter_bot_ids and ev.user_id not in deleter_bot_ids:
                            continue
                        new_p = getattr(ev.action, 'new_participant', None)
                        br = getattr(new_p, 'banned_rights', None) if new_p else None
                        if not br or not getattr(br, 'send_messages', False):
                            continue  # не запрет, а разбан
                        peer = getattr(new_p, 'peer', None)
                        author_id = getattr(peer, 'user_id', None) if peer else None
                        print(f"[adminlog-poll] BAN event={ev.id} target={author_id}")
                    else:
                        continue
                    if not author_id:
                        continue
                    user = users_cache.get(author_id)
                    if not user:
                        try:
                            user = await client.get_entity(author_id)
                        except Exception:
                            continue
                    if getattr(user, 'bot', False):
                        continue
                    if already_sent(author_id):
                        continue
                    username = getattr(user, 'username', '') or ''
                    first_name = getattr(user, 'first_name', '') or 'водитель'
                    personalized = template.replace('{name}', first_name).replace('{username}', username or '')
                    try:
                        await client.send_message(author_id, personalized)
                        log_send(author_id, username, first_name, ev.id, 'ok')
                        adminlog_sent += 1
                        print(f"[adminlog-poll] sent to @{username} (id={author_id})")
                    except FloodWaitError as fe:
                        log_send(author_id, username, first_name, ev.id, f'flood:{fe.seconds}')
                        break
                    except Exception as e:
                        log_send(author_id, username, first_name, ev.id, f'err:{str(e)[:200]}')
                if new_max > last_id:
                    save_settings(last_msg_id=new_max)
            except Exception as e:
                print(f"[adminlog-poll err] {e}")
        finally:
            try:
                await client.disconnect()
            except Exception:
                pass

        return {'ok': True, 'sent': sent_count[0] + adminlog_sent, 'events_seen': events_seen[0], 'duration_sec': round(time.time() - start, 1)}
    except Exception as e:
        return {'ok': False, 'error': str(e)}


def handler(event: dict, context) -> dict:
    """Сканер исключённых: настройки, история и ручной запуск."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {**CORS, 'Access-Control-Max-Age': '86400'}, 'body': ''}

    method = event.get('httpMethod', 'GET')
    qs = event.get('queryStringParameters') or {}
    action = qs.get('action', '')

    # Cron вызов без авторизации
    if method == 'POST' and action == 'cron':
        loop = asyncio.new_event_loop(); asyncio.set_event_loop(loop)
        try:
            return resp(200, loop.run_until_complete(run_scan()))
        finally:
            loop.close()

    # WHOIS: узнать кто такой пользователь по ID или username
    if action == 'whois':
        qs2 = qs.get('id') or qs.get('username') or ''
        target_id = qs2
        if qs2.isdigit() or (qs2.startswith('-') and qs2[1:].isdigit()):
            target_id = int(qs2)
        elif not qs2:
            return resp(400, {'error': 'pass ?id=<user_id> или ?username=<name>'})

        api_id_w = int(os.environ['TG_API_ID'])
        api_hash_w = os.environ['TG_API_HASH']
        session_str_w = get_session2()
        if not session_str_w:
            return resp(200, {'ok': False, 'reason': 'not_logged_in'})
        async def _whois2():
            client = TelegramClient(StringSession(session_str_w), api_id_w, api_hash_w)
            await client.connect()
            try:
                u = await client.get_entity(target_id)
                return {
                    'ok': True,
                    'id': getattr(u, 'id', None),
                    'username': getattr(u, 'username', None),
                    'first_name': getattr(u, 'first_name', None),
                    'last_name': getattr(u, 'last_name', None),
                    'is_bot': getattr(u, 'bot', False),
                    'phone': getattr(u, 'phone', None),
                }
            except Exception as e:
                return {'ok': False, 'error': str(e)}
            finally:
                try: await client.disconnect()
                except Exception: pass
        loop = asyncio.new_event_loop(); asyncio.set_event_loop(loop)
        try:
            return resp(200, loop.run_until_complete(_whois2()))
        finally:
            loop.close()

    # DEBUG: проверить права нашей сессии в группе и список админов
    if action == 'debug_perms':
        session_str = get_session2()
        if not session_str:
            return resp(200, {'ok': False, 'reason': 'not_logged_in'})
        api_id = int(os.environ['TG_API_ID'])
        api_hash = os.environ['TG_API_HASH']
        async def _dbg_perms():
            from telethon.tl.functions.channels import GetParticipantsRequest, GetParticipantRequest
            from telethon.tl.types import ChannelParticipantsAdmins
            client = TelegramClient(StringSession(session_str), api_id, api_hash)
            await client.connect()
            try:
                me = await client.get_me()
                entity = await client.get_entity(TARGET_GROUP)
                # Кто я в группе
                my_part = None
                try:
                    p = await client(GetParticipantRequest(channel=entity, participant=me.id))
                    my_part = type(p.participant).__name__
                except Exception as e:
                    my_part = f'err:{e}'
                # Список админов
                admins = []
                try:
                    res = await client(GetParticipantsRequest(
                        channel=entity, filter=ChannelParticipantsAdmins(),
                        offset=0, limit=50, hash=0
                    ))
                    for u in res.users:
                        admins.append({
                            'id': u.id, 'username': getattr(u, 'username', None),
                            'first_name': getattr(u, 'first_name', None),
                            'is_bot': getattr(u, 'bot', False),
                        })
                except Exception as e:
                    admins = [{'error': str(e)}]
                return {
                    'ok': True,
                    'me_id': me.id, 'me_username': me.username,
                    'group_id': entity.id, 'group_title': getattr(entity, 'title', None),
                    'my_role_in_group': my_part,
                    'admins': admins,
                }
            except Exception as e:
                return {'ok': False, 'error': str(e)}
            finally:
                try: await client.disconnect()
                except Exception: pass
        loop = asyncio.new_event_loop(); asyncio.set_event_loop(loop)
        try:
            return resp(200, loop.run_until_complete(_dbg_perms()))
        finally:
            loop.close()

    # DEBUG: последние сообщения В ЧАТЕ от @VsyaRussiabot
    if action == 'debug_chat':
        session_str = get_session2()
        if not session_str:
            return resp(200, {'ok': False, 'reason': 'not_logged_in'})
        api_id = int(os.environ['TG_API_ID'])
        api_hash = os.environ['TG_API_HASH']
        async def _dbg_chat():
            client = TelegramClient(StringSession(session_str), api_id, api_hash)
            await client.connect()
            try:
                entity = await client.get_entity(TARGET_GROUP)
                bot = await client.get_entity(DELETER_BOT)
                # Берём последние 100 сообщений
                msgs = await client.get_messages(entity, limit=100)
                from_bot = []
                for m in msgs:
                    sender_id = getattr(m, 'sender_id', None) or 0
                    if sender_id == bot.id:
                        from_bot.append({
                            'id': m.id, 'date': str(m.date),
                            'text': (m.text or m.message or '')[:200],
                            'reply_to': getattr(m, 'reply_to_msg_id', None),
                        })
                return {'ok': True, 'bot_id': bot.id, 'msgs_from_bot': from_bot, 'total_scanned': len(msgs)}
            except Exception as e:
                return {'ok': False, 'error': str(e)}
            finally:
                try: await client.disconnect()
                except Exception: pass
        loop = asyncio.new_event_loop(); asyncio.set_event_loop(loop)
        try:
            return resp(200, loop.run_until_complete(_dbg_chat()))
        finally:
            loop.close()

    # DEBUG: ВСЕ события AdminLog за последние 30 минут — найти настоящий тип
    if action == 'debug_all':
        session_str = get_session2()
        if not session_str:
            return resp(200, {'ok': False, 'reason': 'not_logged_in'})
        api_id = int(os.environ['TG_API_ID'])
        api_hash = os.environ['TG_API_HASH']
        async def _dbg_all():
            client = TelegramClient(StringSession(session_str), api_id, api_hash)
            await client.connect()
            try:
                entity = await client.get_entity(TARGET_GROUP)
                bot = await client.get_entity(DELETER_BOT)
                # Все типы событий — полный фильтр (включая send=True для сообщений)
                admin_log = await client(GetAdminLogRequest(
                    channel=entity, q='',
                    events_filter=ChannelAdminLogEventsFilter(
                        join=True, leave=True, invite=True, ban=True, unban=True,
                        kick=True, unkick=True, promote=True, demote=True,
                        info=True, settings=True, pinned=True,
                        edit=True, delete=True, group_call=True, invites=True,
                        send=True, forums=True,
                    ),
                    admins=[bot], max_id=0, min_id=0, limit=100,
                ))
                events_data = []
                for ev in sorted(admin_log.events, key=lambda e: e.id, reverse=True):
                    info = {
                        'event_id': ev.id, 'date': str(ev.date),
                        'deleter_id': ev.user_id,
                        'is_vsyarussia': ev.user_id == bot.id,
                        'action_type': type(ev.action).__name__,
                    }
                    # Извлекаем target user если есть
                    np = getattr(ev.action, 'new_participant', None)
                    pp = getattr(ev.action, 'prev_participant', None)
                    if np:
                        peer = getattr(np, 'peer', None) or getattr(np, 'user_id', None)
                        info['new_target'] = getattr(peer, 'user_id', None) if hasattr(peer, 'user_id') else peer
                        br = getattr(np, 'banned_rights', None)
                        if br:
                            info['new_send_messages_banned'] = getattr(br, 'send_messages', False)
                    if pp:
                        peer = getattr(pp, 'peer', None) or getattr(pp, 'user_id', None)
                        info['prev_target'] = getattr(peer, 'user_id', None) if hasattr(peer, 'user_id') else peer
                    events_data.append(info)
                return {'ok': True, 'bot_id': bot.id, 'total': len(events_data), 'events': events_data}
            except Exception as e:
                return {'ok': False, 'error': str(e)}
            finally:
                try: await client.disconnect()
                except Exception: pass
        loop = asyncio.new_event_loop(); asyncio.set_event_loop(loop)
        try:
            return resp(200, loop.run_until_complete(_dbg_all()))
        finally:
            loop.close()

    # DEBUG: показать последние БАНЫ от @VsyaRussiabot
    if action == 'debug_bans':
        session_str = get_session2()
        if not session_str:
            return resp(200, {'ok': False, 'reason': 'not_logged_in'})
        api_id = int(os.environ['TG_API_ID'])
        api_hash = os.environ['TG_API_HASH']
        async def _dbg_bans():
            client = TelegramClient(StringSession(session_str), api_id, api_hash)
            await client.connect()
            try:
                entity = await client.get_entity(TARGET_GROUP)
                bot = await client.get_entity(DELETER_BOT)
                admin_log = await client(GetAdminLogRequest(
                    channel=entity, q='',
                    events_filter=ChannelAdminLogEventsFilter(delete=True, kick=True, ban=True),
                    admins=[], max_id=0, min_id=0, limit=20,
                ))
                events_data = []
                for ev in sorted(admin_log.events, key=lambda e: e.id, reverse=True):
                    info = {
                        'event_id': ev.id, 'date': str(ev.date),
                        'deleter_id': ev.user_id,
                        'is_vsyarussia': ev.user_id == bot.id,
                        'action_type': type(ev.action).__name__,
                    }
                    if isinstance(ev.action, ChannelAdminLogEventActionParticipantToggleBan):
                        np = getattr(ev.action, 'new_participant', None)
                        peer = getattr(np, 'peer', None) if np else None
                        br = getattr(np, 'banned_rights', None) if np else None
                        info['target_user_id'] = getattr(peer, 'user_id', None) if peer else None
                        info['send_messages_banned'] = getattr(br, 'send_messages', False) if br else None
                        info['view_messages_banned'] = getattr(br, 'view_messages', False) if br else None
                    elif isinstance(ev.action, ChannelAdminLogEventActionDeleteMessage):
                        deleted = ev.action.message
                        from_id = getattr(deleted, 'from_id', None)
                        info['author_id'] = getattr(from_id, 'user_id', None) if from_id else None
                    events_data.append(info)
                return {'ok': True, 'bot_id': bot.id, 'events': events_data}
            except Exception as e:
                return {'ok': False, 'error': str(e)}
            finally:
                try: await client.disconnect()
                except Exception: pass
        loop = asyncio.new_event_loop(); asyncio.set_event_loop(loop)
        try:
            return resp(200, loop.run_until_complete(_dbg_bans()))
        finally:
            loop.close()

    # DEBUG: показать последние события из AdminLog (все типы — удаления, баны, права)
    if action == 'debug_log':
        session_str = get_session2()
        if not session_str:
            return resp(200, {'ok': False, 'reason': 'not_logged_in'})
        api_id = int(os.environ['TG_API_ID'])
        api_hash = os.environ['TG_API_HASH']
        async def _dbg():
            client = TelegramClient(StringSession(session_str), api_id, api_hash)
            await client.connect()
            try:
                entity = await client.get_entity(TARGET_GROUP)
                # Все события — без фильтра, чтобы увидеть права/баны/удаления
                admin_log = await client(GetAdminLogRequest(
                    channel=entity, q='',
                    events_filter=None,
                    admins=[], max_id=0, min_id=0, limit=30,
                ))
                events_data = []
                for ev in sorted(admin_log.events, key=lambda e: e.id, reverse=True):
                    action_type = type(ev.action).__name__
                    info = {
                        'event_id': ev.id,
                        'date': str(ev.date),
                        'deleter_id': ev.user_id,  # кто совершил действие
                        'action_type': action_type,
                    }
                    # Удаление сообщения
                    if isinstance(ev.action, ChannelAdminLogEventActionDeleteMessage):
                        deleted = ev.action.message
                        from_id = getattr(deleted, 'from_id', None)
                        info['author_id'] = getattr(from_id, 'user_id', None) if from_id else None
                        info['text_preview'] = (getattr(deleted, 'message', '') or '')[:80]
                    # Изменение прав / бан — извлекаем target user
                    if hasattr(ev.action, 'new_participant'):
                        np = ev.action.new_participant
                        info['target_user_id'] = getattr(np, 'user_id', None) or getattr(np, 'peer', None)
                    if hasattr(ev.action, 'prev_participant'):
                        pp = ev.action.prev_participant
                        info['prev_target_id'] = getattr(pp, 'user_id', None) or getattr(pp, 'peer', None)
                    events_data.append(info)
                # Кто такие deleter_id (топ)
                deleter_ids = list({e['deleter_id'] for e in events_data if e.get('deleter_id')})
                deleters_info = {}
                for did in deleter_ids[:10]:
                    try:
                        u = await client.get_entity(did)
                        deleters_info[str(did)] = {
                            'username': getattr(u, 'username', None),
                            'first_name': getattr(u, 'first_name', None),
                            'is_bot': getattr(u, 'bot', False),
                        }
                    except Exception:
                        deleters_info[str(did)] = {'error': 'unresolved'}
                return {'ok': True, 'events': events_data, 'deleters': deleters_info, 'total': len(events_data)}
            except Exception as e:
                return {'ok': False, 'error': str(e)}
            finally:
                try: await client.disconnect()
                except Exception: pass
        loop = asyncio.new_event_loop(); asyncio.set_event_loop(loop)
        try:
            return resp(200, loop.run_until_complete(_dbg()))
        finally:
            loop.close()

    # Перезапуск цикла без авторизации (для случаев когда loop умер после деплоя)
    if (method == 'POST' or method == 'GET') and action == 'revive':
        s = get_settings()
        if not s['enabled']:
            return resp(200, {'ok': False, 'reason': 'disabled', 'hint': 'включи слежение в админке'})
        import secrets as _secrets
        new_token = _secrets.token_hex(16)
        set_loop_token(new_token)
        fire_self_loop(new_token)
        return resp(200, {'ok': True, 'revived': True, 'token_preview': new_token[:8] + '…'})

    # 24/7 СЛУШАТЕЛЬ событий (event-driven, экономит compute)
    if method == 'POST' and action == 'loop':
        body_raw = event.get('body') or '{}'
        try:
            body_in = json.loads(body_raw)
        except Exception:
            body_in = {}
        incoming_token = body_in.get('token', '')
        s = get_settings()
        if not s['enabled']:
            return resp(200, {'ok': False, 'reason': 'disabled'})
        if s['loop_token'] and incoming_token != s['loop_token']:
            return resp(200, {'ok': False, 'reason': 'token_mismatch'})

        loop = asyncio.new_event_loop(); asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(run_listener(incoming_token))
            cur_s = get_settings()
            if cur_s['enabled'] and cur_s['loop_token'] == incoming_token:
                fire_self_loop(incoming_token, delay_sec=LOOP_PAUSE_SEC)
                result['restarted'] = True
                result['next_in_sec'] = LOOP_PAUSE_SEC
            return resp(200, result)
        finally:
            loop.close()

    headers = event.get('headers') or {}
    token = headers.get('x-admin-token') or headers.get('X-Admin-Token') or ''
    if not verify_token(token):
        return resp(401, {'error': 'unauthorized'})

    if method == 'GET' and action == 'history':
        conn = db(); cur = conn.cursor()
        cur.execute(
            f"SELECT user_id, username, first_name, message_sent, message_sent_at, send_status "
            f"FROM {SCHEMA}.excluded_drivers ORDER BY id DESC LIMIT 50"
        )
        rows = cur.fetchall()
        cur.close(); conn.close()
        items = [{
            'user_id': r[0], 'username': r[1], 'first_name': r[2],
            'message_sent': r[3], 'message_sent_at': r[4], 'send_status': r[5],
        } for r in rows]
        return resp(200, {'items': items})

    if method == 'GET':
        s = get_settings()
        return resp(200, s)

    body = json.loads(event.get('body') or '{}')

    if method == 'POST' and action == 'settings':
        enabled = body.get('enabled')
        template = body.get('message_template')
        save_settings(enabled=enabled, template=template)
        # Запускаем/перезапускаем цикл если включено
        if enabled:
            import secrets
            new_token = secrets.token_hex(16)
            set_loop_token(new_token)
            fire_self_loop(new_token)
            return resp(200, {'ok': True, 'loop_started': True})
        else:
            # Сбрасываем токен — старые циклы умрут на следующей итерации
            set_loop_token('')
            return resp(200, {'ok': True, 'loop_stopped': True})

    if method == 'POST' and action == 'run':
        loop = asyncio.new_event_loop(); asyncio.set_event_loop(loop)
        try:
            return resp(200, loop.run_until_complete(run_scan()))
        finally:
            loop.close()

    return resp(400, {'error': 'unknown action'})