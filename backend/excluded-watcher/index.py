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
    InputPeerUser,
)

SELF_URL = 'https://functions.poehali.dev/2db8bbe3-c6b3-4bda-866c-c22a8c621520'
LOOP_DURATION_SEC = 12  # макс время одного запуска (экономия compute, проверка обновлений короче)
LOOP_PAUSE_SEC = 1800  # пауза между циклами (30 мин) — режим экономии бюджета
                       # 12/(12+1800) ≈ 0.66% от 24/7 → ~5ч расхода/мес (было ~23ч)
HEARTBEAT_EVERY_SEC = 30  # как часто обновлять heartbeat в БД (реже = меньше DB-вызовов)
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


def personalize(template: str, first_name: str, username: str) -> str:
    """Подставляет имя/username в шаблон.
    Поддерживает {name} и {username}. Если переменных нет — добавляет приветствие.
    Корректно обрабатывает 'Уважаемый !' (вставит имя перед !).
    """
    fname = (first_name or '').strip() or 'водитель'
    uname = (username or '').strip()
    txt = template or ''

    # 1) подставим явные плейсхолдеры
    txt = txt.replace('{name}', fname).replace('{username}', uname)

    # 2) исправим случай 'Уважаемый !' / 'Уважаемая !' — вставим имя перед !
    txt = re.sub(r'(Уважаем(?:ый|ая|ые))\s*([!,])', rf'\1 {fname}\2', txt)

    # 3) исправим случай 'Здравствуйте !' / 'Привет !'
    txt = re.sub(r'(Здравствуй(?:те)?|Привет|Добрый день|Добрый вечер|Доброе утро)\s*([!,])',
                 rf'\1, {fname}\2', txt)

    # 4) если в тексте нет имени и нет привычного приветствия — добавим в начало
    if fname not in txt and not re.match(r'^\s*(Уважаем|Здравствуй|Привет|Добрый|Доброе)', txt):
        txt = f"Здравствуйте, {fname}!\n\n{txt}"

    return txt


def db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def get_settings() -> dict:
    conn = db(); cur = conn.cursor()
    cur.execute(f"SELECT enabled, message_template, last_checked_msg_id, last_run_at, loop_token, loop_heartbeat, EXTRACT(EPOCH FROM (NOW() - loop_heartbeat)) FROM {SCHEMA}.excluded_settings WHERE id=1")
    r = cur.fetchone()
    cur.close(); conn.close()
    if not r:
        return {'enabled': False, 'message_template': '', 'last_checked_msg_id': 0, 'last_run_at': None, 'loop_token': None, 'loop_heartbeat': None, 'loop_alive': False, 'loop_age_sec': None}
    age = int(r[6] or 999999) if r[6] is not None else None
    # Цикл считается живым если heartbeat был не более 5 минут назад
    alive = bool(r[0]) and age is not None and age < 300
    return {
        'enabled': r[0], 'message_template': r[1], 'last_checked_msg_id': int(r[2] or 0),
        'last_run_at': r[3], 'loop_token': r[4], 'loop_heartbeat': r[5],
        'loop_alive': alive, 'loop_age_sec': age,
    }


def auto_revive_if_needed() -> dict:
    """Если цикл должен работать (enabled=TRUE) но heartbeat старше 5 минут — возрождает его.
    Вызывается на любом GET — пользователь зашёл в админку и фронт спросил статус → починили."""
    try:
        s = get_settings()
        if not s.get('enabled'):
            return {'revived': False, 'reason': 'disabled'}
        if s.get('loop_alive'):
            return {'revived': False, 'reason': 'alive'}
        import secrets as _secrets
        new_token = _secrets.token_hex(16)
        set_loop_token(new_token)
        fire_self_loop(new_token)
        return {'revived': True, 'age_sec': s.get('loop_age_sec')}
    except Exception as e:
        return {'revived': False, 'error': str(e)[:200]}


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


def log_send(user_id, username, first_name, source_msg_id, status: str, access_hash=None):
    """Записывает результат отправки + сохраняет access_hash чтобы потом писать
    даже водителям, которые ушли из группы."""
    conn = db(); cur = conn.cursor()
    ah_sql = f"{int(access_hash)}" if access_hash is not None else "NULL"
    cur.execute(
        f"INSERT INTO {SCHEMA}.excluded_drivers (user_id, username, first_name, source_msg_id, message_sent, message_sent_at, send_status, access_hash) "
        f"VALUES ({int(user_id) if user_id else 0}, '{esc(username)}', '{esc(first_name)}', "
        f"{int(source_msg_id) if source_msg_id else 0}, {'TRUE' if status == 'ok' else 'FALSE'}, NOW(), '{esc(status)}', {ah_sql})"
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

            personalized = personalize(template, first_name, username)
            ah = getattr(user, 'access_hash', None)
            try:
                await client.send_message(author_id, personalized)
                log_send(author_id, username, first_name, ev.id, 'ok', access_hash=ah)
                sent_count += 1
                found.append({'user_id': author_id, 'username': username, 'first_name': first_name, 'event_id': ev.id})
            except FloodWaitError as fe:
                log_send(author_id, username, first_name, ev.id, f'flood:{fe.seconds}', access_hash=ah)
                errors.append({'event_id': ev.id, 'reason': f'flood {fe.seconds}s'})
                break
            except Exception as e:
                log_send(author_id, username, first_name, ev.id, f'err:{str(e)[:200]}', access_hash=ah)
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

    personalized = personalize(template, first_name, username)
    ah = getattr(u, 'access_hash', None) if u else None
    try:
        await client.send_message(user_id, personalized)
        log_send(user_id, username, first_name, msg.id, 'ok', access_hash=ah)
        return {'ok': True, 'user_id': user_id, 'username': username}
    except FloodWaitError as fe:
        log_send(user_id, username, first_name, msg.id, f'flood:{fe.seconds}', access_hash=ah)
        return {'ok': False, 'reason': f'flood:{fe.seconds}'}
    except Exception as e:
        log_send(user_id, username, first_name, msg.id, f'err:{str(e)[:200]}', access_hash=ah)
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
                    personalized = personalize(template, first_name, username)
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

    # Cron вызов: защита по секретному заголовку X-Cron-Secret
    # Используется внешним планировщиком (cron-job.org), вызывает run_scan() — один проход
    if method == 'POST' and action == 'cron':
        cron_secret = os.environ.get('CRON_SECRET', '')
        headers_in = event.get('headers') or {}
        provided = headers_in.get('X-Cron-Secret') or headers_in.get('x-cron-secret') or ''
        if not cron_secret or provided != cron_secret:
            return resp(401, {'error': 'invalid cron secret'})
        loop = asyncio.new_event_loop(); asyncio.set_event_loop(loop)
        try:
            return resp(200, loop.run_until_complete(run_scan()))
        finally:
            loop.close()

    # ENRICH: пробегает admin-log и заполняет access_hash для существующих записей.
    # Нужно если водители уже в БД, но без access_hash — теперь сможем им писать даже после выхода.
    if method == 'POST' and action == 'enrich_hashes':
        headers_in = event.get('headers') or {}
        token = headers_in.get('X-Admin-Token') or headers_in.get('x-admin-token') or ''
        if not verify_token(token):
            return resp(401, {'error': 'invalid token'})

        session_str_e = get_session2()
        if not session_str_e:
            return resp(200, {'ok': False, 'reason': 'not_logged_in'})

        api_id_e = int(os.environ['TG_API_ID'])
        api_hash_e = os.environ['TG_API_HASH']

        async def _enrich():
            client = TelegramClient(StringSession(session_str_e), api_id_e, api_hash_e)
            await client.connect()
            updated = 0
            scanned_users = 0
            try:
                target_entity = await client.get_entity(TARGET_GROUP)
                # 1) Тянем всю историю admin-лога — там есть users с access_hash
                from telethon.tl.types import ChannelAdminLogEventsFilter as _Filter
                max_id = 0
                seen_user_ids = {}
                for _ in range(20):  # до 20 страниц по 100 = 2000 событий
                    al = await client(GetAdminLogRequest(
                        channel=target_entity,
                        q='',
                        events_filter=_Filter(
                            join=False, leave=False, invite=False,
                            ban=True, unban=False, kick=False, unkick=False,
                            promote=False, demote=False, info=False,
                            settings=False, pinned=False, edit=False, delete=True,
                        ),
                        admins=[],
                        max_id=max_id,
                        min_id=0,
                        limit=100,
                    ))
                    if not al.events:
                        break
                    for u in al.users:
                        ah = getattr(u, 'access_hash', None)
                        if ah is not None:
                            seen_user_ids[u.id] = ah
                            scanned_users += 1
                    max_id = min(e.id for e in al.events) - 1
                    if max_id <= 0:
                        break
                # 2) Обновляем в БД тех, кого нашли
                if seen_user_ids:
                    conn = db(); cur = conn.cursor()
                    for uid, ah in seen_user_ids.items():
                        cur.execute(
                            f"UPDATE {SCHEMA}.excluded_drivers SET access_hash={int(ah)} "
                            f"WHERE user_id={int(uid)} AND access_hash IS NULL"
                        )
                        updated += cur.rowcount
                    conn.commit(); cur.close(); conn.close()
                return {'ok': True, 'scanned_users': scanned_users, 'updated_records': updated, 'unique_users_with_hash': len(seen_user_ids)}
            except Exception as e:
                return {'ok': False, 'error': str(e)[:300]}
            finally:
                try:
                    await client.disconnect()
                except Exception:
                    pass

        loop = asyncio.new_event_loop(); asyncio.set_event_loop(loop)
        try:
            return resp(200, loop.run_until_complete(_enrich()))
        finally:
            loop.close()

    # RESEND: повторная рассылка по resend_queued=TRUE
    # POST ?action=resend  Header: X-Admin-Token
    if method == 'POST' and action == 'resend':
        headers_in = event.get('headers') or {}
        token = headers_in.get('X-Admin-Token') or headers_in.get('x-admin-token') or ''
        if not verify_token(token):
            return resp(401, {'error': 'invalid token'})

        session_str_r = get_session2()
        if not session_str_r:
            return resp(200, {'ok': False, 'reason': 'not_logged_in'})

        settings_r = get_settings()
        template_r = settings_r['message_template'] or 'Здравствуйте!'

        # Берём очередь + access_hash для прямого резолва тех, кто вышел из группы
        conn = db(); cur = conn.cursor()
        cur.execute(
            f"SELECT id, user_id, username, first_name, access_hash FROM {SCHEMA}.excluded_drivers "
            f"WHERE resend_queued=TRUE AND user_id IS NOT NULL AND user_id <> 0 "
            f"ORDER BY id ASC LIMIT 100"
        )
        queue = cur.fetchall()
        cur.close(); conn.close()

        if not queue:
            return resp(200, {'ok': True, 'sent': 0, 'queue_empty': True})

        api_id_r = int(os.environ['TG_API_ID'])
        api_hash_r = os.environ['TG_API_HASH']

        async def _resend():
            client = TelegramClient(StringSession(session_str_r), api_id_r, api_hash_r)
            await client.connect()
            sent_ok = 0
            errors_list = []
            try:
                # Прогрев кэша: тянем участников @UG_DRIVER, чтобы Telethon знал access_hash
                try:
                    target_entity = await client.get_entity(TARGET_GROUP)
                    cnt = 0
                    async for _u in client.iter_participants(target_entity, limit=5000):
                        cnt += 1
                    print(f"[resend] participants warmed up: {cnt}")
                except Exception as e:
                    print(f"[resend] participants warmup err: {e}")

                for row in queue:
                    rec_id, uid, uname, fname, ah = row
                    uid = int(uid) if uid else 0
                    fname = fname or 'водитель'
                    uname = uname or ''
                    ah = int(ah) if ah is not None else None
                    personalized = personalize(template_r, fname, uname)

                    # Стратегия резолва, по приоритету:
                    # 1) Сохранённый access_hash → InputPeerUser напрямую (работает даже после выхода из группы)
                    # 2) Кэш Telethon (если водитель ещё в группе)
                    # 3) @username (если есть)
                    target = None
                    if ah is not None:
                        try:
                            target = InputPeerUser(user_id=uid, access_hash=ah)
                        except Exception:
                            target = None
                    if target is None:
                        try:
                            target = await client.get_input_entity(uid)
                        except Exception:
                            if uname:
                                try:
                                    target = await client.get_input_entity(uname)
                                except Exception:
                                    target = None

                    if target is None:
                        c2 = db(); cu2 = c2.cursor()
                        cu2.execute(
                            f"UPDATE {SCHEMA}.excluded_drivers "
                            f"SET resend_queued=FALSE, resend_status='unreachable: нет access_hash, вышел из группы, нет @username', resend_at=NOW() "
                            f"WHERE id={int(rec_id)}"
                        )
                        c2.commit(); cu2.close(); c2.close()
                        errors_list.append({'id': rec_id, 'reason': 'unreachable'})
                        continue

                    try:
                        await client.send_message(target, personalized)
                        c2 = db(); cu2 = c2.cursor()
                        cu2.execute(
                            f"UPDATE {SCHEMA}.excluded_drivers "
                            f"SET resend_queued=FALSE, resend_status='ok', resend_at=NOW() "
                            f"WHERE id={int(rec_id)}"
                        )
                        c2.commit(); cu2.close(); c2.close()
                        sent_ok += 1
                        await asyncio.sleep(2)
                    except FloodWaitError as fe:
                        c2 = db(); cu2 = c2.cursor()
                        cu2.execute(
                            f"UPDATE {SCHEMA}.excluded_drivers "
                            f"SET resend_status='flood:{int(fe.seconds)}', resend_at=NOW() "
                            f"WHERE id={int(rec_id)}"
                        )
                        c2.commit(); cu2.close(); c2.close()
                        errors_list.append({'id': rec_id, 'reason': f'flood:{fe.seconds}'})
                        break
                    except Exception as e:
                        err_text = str(e)[:200].replace("'", "''")
                        c2 = db(); cu2 = c2.cursor()
                        cu2.execute(
                            f"UPDATE {SCHEMA}.excluded_drivers "
                            f"SET resend_queued=FALSE, resend_status='err:{err_text}', resend_at=NOW() "
                            f"WHERE id={int(rec_id)}"
                        )
                        c2.commit(); cu2.close(); c2.close()
                        errors_list.append({'id': rec_id, 'reason': str(e)[:200]})
            finally:
                try:
                    await client.disconnect()
                except Exception:
                    pass
            return {'ok': True, 'sent': sent_ok, 'queue_size': len(queue), 'errors': errors_list}

        loop_r = asyncio.new_event_loop(); asyncio.set_event_loop(loop_r)
        try:
            return resp(200, loop_r.run_until_complete(_resend()))
        finally:
            loop_r.close()

    # RESEND status: посмотреть очередь
    if method == 'GET' and action == 'resend_status':
        conn = db(); cur = conn.cursor()
        cur.execute(
            f"SELECT COUNT(*) FILTER (WHERE resend_queued=TRUE) AS queued, "
            f"COUNT(*) FILTER (WHERE resend_status='ok') AS ok, "
            f"COUNT(*) FILTER (WHERE resend_status LIKE 'err:%' OR resend_status LIKE 'flood:%') AS failed "
            f"FROM {SCHEMA}.excluded_drivers"
        )
        r = cur.fetchone()
        cur.close(); conn.close()
        return resp(200, {'queued': int(r[0] or 0), 'ok': int(r[1] or 0), 'failed': int(r[2] or 0)})

    # RESEND list: список тех, кому не отправили (для UI «Сканировать»)
    if method == 'GET' and action == 'resend_list':
        conn = db(); cur = conn.cursor()
        cur.execute(
            f"SELECT id, user_id, username, first_name, send_status, resend_queued "
            f"FROM {SCHEMA}.excluded_drivers "
            f"WHERE user_id IS NOT NULL AND user_id <> 0 "
            f"AND (message_sent=FALSE OR send_status IS NULL OR send_status LIKE 'err:%' OR send_status LIKE 'flood:%') "
            f"AND (resend_status IS NULL OR resend_status <> 'ok') "
            f"ORDER BY id DESC LIMIT 200"
        )
        rows = cur.fetchall()
        cur.close(); conn.close()
        items = [{
            'id': r[0], 'user_id': r[1], 'username': r[2] or '',
            'first_name': r[3] or '', 'send_status': r[4] or '', 'queued': bool(r[5]),
        } for r in rows]
        return resp(200, {'ok': True, 'items': items, 'count': len(items)})

    # SEND ONE: отправить повторно одному водителю по id записи
    if method == 'POST' and action == 'send_one':
        headers_in = event.get('headers') or {}
        token = headers_in.get('X-Admin-Token') or headers_in.get('x-admin-token') or ''
        if not verify_token(token):
            return resp(401, {'error': 'invalid token'})
        body_in = json.loads(event.get('body') or '{}')
        rec_id = int(body_in.get('id') or 0)
        if not rec_id:
            return resp(400, {'ok': False, 'error': 'id required'})

        session_str_o = get_session2()
        if not session_str_o:
            return resp(200, {'ok': False, 'reason': 'not_logged_in'})

        settings_o = get_settings()
        template_o = settings_o['message_template'] or 'Здравствуйте!'

        conn = db(); cur = conn.cursor()
        cur.execute(
            f"SELECT user_id, username, first_name FROM {SCHEMA}.excluded_drivers WHERE id={rec_id}"
        )
        row = cur.fetchone()
        cur.close(); conn.close()
        if not row:
            return resp(404, {'ok': False, 'error': 'not_found'})

        uid_o = int(row[0] or 0)
        uname_o = row[1] or ''
        fname_o = row[2] or 'водитель'
        if not uid_o:
            return resp(400, {'ok': False, 'error': 'no_user_id'})

        personalized_o = personalize(template_o, fname_o, uname_o)

        api_id_o = int(os.environ['TG_API_ID'])
        api_hash_o = os.environ['TG_API_HASH']

        async def _send_one():
            client = TelegramClient(StringSession(session_str_o), api_id_o, api_hash_o)
            await client.connect()
            try:
                target = uid_o
                try:
                    target = await client.get_input_entity(uid_o)
                except Exception:
                    if uname_o:
                        try:
                            target = await client.get_input_entity(uname_o)
                        except Exception:
                            target = uid_o
                await client.send_message(target, personalized_o)
                c2 = db(); cu2 = c2.cursor()
                cu2.execute(
                    f"UPDATE {SCHEMA}.excluded_drivers "
                    f"SET resend_queued=FALSE, resend_status='ok', resend_at=NOW(), "
                    f"message_sent=TRUE, send_status='ok' "
                    f"WHERE id={rec_id}"
                )
                c2.commit(); cu2.close(); c2.close()
                return {'ok': True}
            except Exception as e:
                err_text = str(e)[:200].replace("'", "''")
                c2 = db(); cu2 = c2.cursor()
                cu2.execute(
                    f"UPDATE {SCHEMA}.excluded_drivers "
                    f"SET resend_status='err:{err_text}', resend_at=NOW() "
                    f"WHERE id={rec_id}"
                )
                c2.commit(); cu2.close(); c2.close()
                return {'ok': False, 'error': str(e)[:200]}
            finally:
                try:
                    await client.disconnect()
                except Exception:
                    pass

        loop_o = asyncio.new_event_loop(); asyncio.set_event_loop(loop_o)
        try:
            return resp(200, loop_o.run_until_complete(_send_one()))
        finally:
            loop_o.close()

    # DELETE ONE: удалить запись из истории
    if method == 'POST' and action == 'delete_one':
        headers_in = event.get('headers') or {}
        token = headers_in.get('X-Admin-Token') or headers_in.get('x-admin-token') or ''
        if not verify_token(token):
            return resp(401, {'error': 'invalid token'})
        body_in = json.loads(event.get('body') or '{}')
        rec_id = int(body_in.get('id') or 0)
        if not rec_id:
            return resp(400, {'ok': False, 'error': 'id required'})
        conn = db(); cur = conn.cursor()
        cur.execute(f"DELETE FROM {SCHEMA}.excluded_drivers WHERE id={rec_id}")
        conn.commit(); cur.close(); conn.close()
        return resp(200, {'ok': True})

    # UPDATE ONE: править имя/username записи
    if method == 'POST' and action == 'update_one':
        headers_in = event.get('headers') or {}
        token = headers_in.get('X-Admin-Token') or headers_in.get('x-admin-token') or ''
        if not verify_token(token):
            return resp(401, {'error': 'invalid token'})
        body_in = json.loads(event.get('body') or '{}')
        rec_id = int(body_in.get('id') or 0)
        if not rec_id:
            return resp(400, {'ok': False, 'error': 'id required'})
        first_name = (body_in.get('first_name') or '').strip()
        username = (body_in.get('username') or '').strip().lstrip('@')
        conn = db(); cur = conn.cursor()
        cur.execute(
            f"UPDATE {SCHEMA}.excluded_drivers "
            f"SET first_name='{esc(first_name)}', username='{esc(username)}' "
            f"WHERE id={rec_id}"
        )
        conn.commit(); cur.close(); conn.close()
        return resp(200, {'ok': True})

    # SCAN: помечает всех неотправленных как queued (готовит очередь для Отправить)
    if method == 'POST' and action == 'scan':
        headers_in = event.get('headers') or {}
        token = headers_in.get('X-Admin-Token') or headers_in.get('x-admin-token') or ''
        if not verify_token(token):
            return resp(401, {'error': 'invalid token'})
        conn = db(); cur = conn.cursor()
        cur.execute(
            f"UPDATE {SCHEMA}.excluded_drivers SET resend_queued=TRUE "
            f"WHERE user_id IS NOT NULL AND user_id <> 0 "
            f"AND (message_sent=FALSE OR send_status IS NULL OR send_status LIKE 'err:%' OR send_status LIKE 'flood:%') "
            f"AND (resend_status IS NULL OR resend_status <> 'ok') "
            f"AND resend_queued=FALSE"
        )
        added = cur.rowcount
        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.excluded_drivers WHERE resend_queued=TRUE")
        total = int(cur.fetchone()[0] or 0)
        conn.commit(); cur.close(); conn.close()
        return resp(200, {'ok': True, 'added': int(added or 0), 'total_queued': total})

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
            f"SELECT id, user_id, username, first_name, message_sent, message_sent_at, send_status "
            f"FROM {SCHEMA}.excluded_drivers ORDER BY id DESC LIMIT 50"
        )
        rows = cur.fetchall()
        cur.close(); conn.close()
        items = [{
            'id': r[0], 'user_id': r[1], 'username': r[2], 'first_name': r[3],
            'message_sent': r[4], 'message_sent_at': r[5], 'send_status': r[6],
        } for r in rows]
        return resp(200, {'items': items})

    if method == 'GET':
        # Авто-починка цикла: если фоновый слушатель умер (heartbeat > 5 мин), а enabled=TRUE — оживляем
        revive_info = auto_revive_if_needed()
        s = get_settings()
        if revive_info.get('revived'):
            s['auto_revived'] = True
            s['auto_revived_after_sec'] = revive_info.get('age_sec')
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