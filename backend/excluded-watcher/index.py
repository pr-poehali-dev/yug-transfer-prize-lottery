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
)

SELF_URL = 'https://functions.poehali.dev/2db8bbe3-c6b3-4bda-866c-c22a8c621520'
LOOP_DURATION_SEC = 25  # макс время одного запуска (укладываемся в таймаут 30)
HEARTBEAT_EVERY_SEC = 10  # как часто обновлять heartbeat в БД
WATCHDOG_DEAD_AFTER_SEC = 60  # если heartbeat старше — считаем loop мёртвым, поднимаем новый
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


def fire_self_loop(token: str):
    """Запускает себя же в фоне (POST ?action=loop) и сразу возвращается."""
    def _go():
        try:
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


def watchdog_check_and_revive() -> dict:
    """Проверяет heartbeat. Поднимает loop ТОЛЬКО если loop_token уже задан (loop-режим явно включён).
    В cron-режиме (loop_token=NULL) ничего не делает — экономим compute.
    """
    s = get_settings()
    if not s['enabled']:
        return {'revived': False, 'reason': 'disabled'}
    if not s.get('loop_token'):
        return {'revived': False, 'reason': 'cron_mode'}
    hb = s.get('loop_heartbeat')
    age = None
    if hb is not None:
        try:
            from datetime import datetime
            now = datetime.now(hb.tzinfo) if hb.tzinfo else datetime.utcnow()
            age = int((now - hb).total_seconds())
        except Exception:
            age = None
    if hb is not None and age is not None and age < WATCHDOG_DEAD_AFTER_SEC:
        return {'revived': False, 'reason': 'alive', 'age_sec': age}
    new_token = hashlib.sha256(f"{time.time()}:{os.urandom(8).hex()}".encode()).hexdigest()[:32]
    set_loop_token(new_token)
    fire_self_loop(new_token)
    return {'revived': True, 'reason': 'dead' if hb else 'no_heartbeat', 'age_sec': age, 'new_token': new_token[:8] + '…'}


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

        # Читаем АДМИН-ЛОГ группы — там фиксируются удаления сообщений ботом
        # ВАЖНО: аккаунт должен быть админом группы @UG_DRIVER, иначе AdminLog недоступен
        try:
            admin_log = await client(GetAdminLogRequest(
                channel=entity,
                q='',
                events_filter=ChannelAdminLogEventsFilter(
                    delete=True,
                ),
                admins=[],
                max_id=0,
                min_id=last_id,  # берём только новые события после last_id
                limit=100,
            ))
        except Exception as e:
            return {'ok': False, 'error': f'AdminLog недоступен (аккаунт должен быть админом): {e}'}

        events = list(admin_log.events)
        events.sort(key=lambda e: e.id)  # от старых к новым

        # Кеш юзеров из лога
        users_cache = {u.id: u for u in admin_log.users}

        # Резолвим ID бота-удалятора (только его удаления нас интересуют)
        deleter_bot_ids = set()
        try:
            b = await client.get_entity(DELETER_BOT)
            deleter_bot_ids.add(b.id)
        except Exception as e:
            print(f"[adminlog] cannot resolve {DELETER_BOT}: {e}")

        for ev in events:
            if ev.id > new_last_id:
                new_last_id = ev.id
            action = ev.action
            if not isinstance(action, ChannelAdminLogEventActionDeleteMessage):
                continue
            # Фильтр: реагируем только если удалил @VsyaRussiabot
            if deleter_bot_ids and ev.user_id not in deleter_bot_ids:
                print(f"[adminlog] skip event={ev.id} deleter_id={ev.user_id} (not VsyaRussiabot)")
                continue
            deleted = action.message
            author_id = None
            # Достаём ID автора удалённого сообщения
            if hasattr(deleted, 'from_id') and deleted.from_id:
                from_id = deleted.from_id
                # PeerUser имеет .user_id
                author_id = getattr(from_id, 'user_id', None)
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

            # Fallback: опрос AdminLog (один раз за цикл)
            adminlog_sent = 0
            try:
                from telethon.tl.functions.channels import GetAdminLogRequest as _GAL
                from telethon.tl.types import (
                    ChannelAdminLogEventsFilter as _F,
                    ChannelAdminLogEventActionDeleteMessage as _DEL,
                )
                cur_s = get_settings()
                last_id = cur_s['last_checked_msg_id']
                admin_log = await client(_GAL(
                    channel=target_entity, q='', events_filter=_F(delete=True),
                    admins=[], max_id=0, min_id=last_id, limit=50,
                ))
                ev_list = sorted(admin_log.events, key=lambda e: e.id)
                users_cache = {u.id: u for u in admin_log.users}
                # Резолвим ID @VsyaRussiabot
                deleter_bot_ids = set()
                try:
                    b = await client.get_entity(DELETER_BOT)
                    deleter_bot_ids.add(b.id)
                except Exception as _e:
                    print(f"[adminlog-poll] cannot resolve {DELETER_BOT}: {_e}")
                new_max = last_id
                for ev in ev_list:
                    if ev.id > new_max:
                        new_max = ev.id
                    if not isinstance(ev.action, _DEL):
                        continue
                    # Фильтр: только удаления от @VsyaRussiabot
                    if deleter_bot_ids and ev.user_id not in deleter_bot_ids:
                        continue
                    deleted = ev.action.message
                    from_id = getattr(deleted, 'from_id', None)
                    author_id = getattr(from_id, 'user_id', None) if from_id else None
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

    # Cron вызов без авторизации (+ watchdog: оживляет упавший loop)
    if method == 'POST' and action == 'cron':
        wd = watchdog_check_and_revive()
        loop = asyncio.new_event_loop(); asyncio.set_event_loop(loop)
        try:
            r = loop.run_until_complete(run_scan())
            r['watchdog'] = wd
            return resp(200, r)
        finally:
            loop.close()

    # Лёгкий watchdog-пинг без сканирования (для частого внешнего крона)
    if method == 'POST' and action == 'watchdog':
        return resp(200, watchdog_check_and_revive())

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
                fire_self_loop(incoming_token)
                result['restarted'] = True
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
        wd = watchdog_check_and_revive()
        s = get_settings()
        s['watchdog'] = wd
        return resp(200, s)

    body = json.loads(event.get('body') or '{}')

    if method == 'POST' and action == 'settings':
        enabled = body.get('enabled')
        template = body.get('message_template')
        save_settings(enabled=enabled, template=template)
        # Останавливаем старый loop (если был) — теперь работаем по cron раз в минуту
        set_loop_token('')
        return resp(200, {'ok': True, 'mode': 'cron-1min'})

    if method == 'POST' and action == 'run':
        loop = asyncio.new_event_loop(); asyncio.set_event_loop(loop)
        try:
            return resp(200, loop.run_until_complete(run_scan()))
        finally:
            loop.close()

    return resp(400, {'error': 'unknown action'})