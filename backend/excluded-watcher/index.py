"""Сканер группы @UG_DRIVER: ловит сообщения от @VsyaRussiabot ('удалил(а) сообщение от ...'),
определяет автора удалённого сообщения и шлёт ему в ЛС шаблон от имени второго user-аккаунта.

GET                         — статус
POST ?action=settings       — обновить шаблон/enabled (старт/стоп цикла)
POST ?action=run            — одноразовый ручной запуск
POST ?action=loop           — цикл 24/7: сканит каждые 5 сек, в конце таймаута перезапускает себя
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

from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.errors import FloodWaitError

SELF_URL = 'https://functions.poehali.dev/2db8bbe3-c6b3-4bda-866c-c22a8c621520'
LOOP_DURATION_SEC = 25  # макс время одного запуска (укладываемся в таймаут 30)
SCAN_INTERVAL_SEC = 5   # пауза между сканами внутри цикла

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

        # Берём последние 100 сообщений; если впервые — стартуем с самых свежих
        msgs = []
        async for m in client.iter_messages(entity, limit=100):
            msgs.append(m)
            if m.id > new_last_id:
                new_last_id = m.id
            if last_id > 0 and m.id <= last_id:
                break

        # Идём от старых к новым
        msgs.reverse()

        # Регулярка: "Payment удалил(а) ... сообщение от <ИМЯ>:" — после идёт цитата
        # На скрине: "Payment удалил(а) 1 сообщение от Олег:"
        # Имя автора — после "от " до ":"
        # А username извлекаем из reply-сообщения (если есть)
        for m in msgs:
            text = (m.text or m.message or '')
            if not text:
                continue
            # Сообщение должно быть от @VsyaRussiabot
            sender = await m.get_sender() if m.sender_id else None
            sender_username = (getattr(sender, 'username', '') or '').lower() if sender else ''
            if sender_username != DELETER_BOT.lower():
                continue
            # Ищем именно фразу про удаление
            mt = re.search(r'удалил.*?\bот\s+([^:\n]+):', text, re.IGNORECASE)
            if not mt:
                continue
            display_name = mt.group(1).strip()

            # Достаём автора удалённого сообщения через reply
            reply = None
            if m.reply_to_msg_id:
                try:
                    reply = await client.get_messages(entity, ids=m.reply_to_msg_id)
                except Exception:
                    reply = None

            user_id = None
            username = ''
            first_name = display_name
            if reply and getattr(reply, 'sender_id', None):
                user_id = reply.sender_id
                try:
                    u = await reply.get_sender()
                    if u:
                        username = getattr(u, 'username', '') or ''
                        first_name = getattr(u, 'first_name', '') or display_name
                except Exception:
                    pass

            if not user_id:
                errors.append({'msg_id': m.id, 'reason': 'no_reply_author', 'name': display_name})
                continue

            # Не шлём повторно
            if already_sent(user_id):
                continue

            # Подставляем имя
            personalized = template.replace('{name}', first_name).replace('{username}', username or '')
            # Шлём в ЛС
            try:
                await client.send_message(user_id, personalized)
                log_send(user_id, username, first_name, m.id, 'ok')
                sent_count += 1
                found.append({'user_id': user_id, 'username': username, 'first_name': first_name, 'msg_id': m.id})
            except FloodWaitError as fe:
                log_send(user_id, username, first_name, m.id, f'flood:{fe.seconds}')
                errors.append({'msg_id': m.id, 'reason': f'flood {fe.seconds}s'})
                break
            except Exception as e:
                log_send(user_id, username, first_name, m.id, f'err:{str(e)[:200]}')
                errors.append({'msg_id': m.id, 'reason': str(e)[:200]})

        save_settings(last_msg_id=new_last_id)
        return {'ok': True, 'sent': sent_count, 'found': found, 'errors': errors, 'last_msg_id': new_last_id}
    finally:
        try:
            await client.disconnect()
        except Exception:
            pass


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

    # 24/7 цикл — без авторизации (защищён токеном из БД)
    if method == 'POST' and action == 'loop':
        body_raw = event.get('body') or '{}'
        try:
            body_in = json.loads(body_raw)
        except Exception:
            body_in = {}
        incoming_token = body_in.get('token', '')
        s = get_settings()
        # Проверка: цикл активен и токен совпадает
        if not s['enabled']:
            return resp(200, {'ok': False, 'reason': 'disabled'})
        if s['loop_token'] and incoming_token != s['loop_token']:
            return resp(200, {'ok': False, 'reason': 'token_mismatch_old_loop_dies'})

        loop = asyncio.new_event_loop(); asyncio.set_event_loop(loop)
        start = time.time()
        scans = 0
        total_sent = 0
        try:
            while time.time() - start < LOOP_DURATION_SEC:
                # проверяем что цикл всё ещё нужен
                cur_s = get_settings()
                if not cur_s['enabled'] or cur_s['loop_token'] != incoming_token:
                    return resp(200, {'ok': True, 'stopped': True, 'scans': scans, 'sent': total_sent})
                heartbeat()
                try:
                    res = loop.run_until_complete(run_scan())
                    if res.get('ok'):
                        total_sent += res.get('sent', 0)
                except Exception as e:
                    print(f"[loop scan err] {e}")
                scans += 1
                # Спим до следующего скана
                remain = LOOP_DURATION_SEC - (time.time() - start)
                if remain > SCAN_INTERVAL_SEC + 2:
                    time.sleep(SCAN_INTERVAL_SEC)
                else:
                    break
            # Цикл закончился — перезапускаем себя
            cur_s = get_settings()
            if cur_s['enabled'] and cur_s['loop_token'] == incoming_token:
                fire_self_loop(incoming_token)
            return resp(200, {'ok': True, 'scans': scans, 'sent': total_sent, 'restarted': True})
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