"""Telethon-логин ВТОРОГО user-аккаунта (для авто-сообщений исключённым из @UG_DRIVER)."""
import os
import json
import hashlib
import asyncio
import psycopg2

from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.errors import SessionPasswordNeededError, PhoneCodeInvalidError, PhoneNumberInvalidError

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
}
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')
SESSION_TABLE = 'tg_user_session2'


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


def get_state() -> dict:
    conn = db()
    cur = conn.cursor()
    cur.execute(f"SELECT phone, phone_code_hash, session_string, logged_in, user_info FROM {SCHEMA}.{SESSION_TABLE} WHERE id=1")
    r = cur.fetchone()
    cur.close(); conn.close()
    if not r:
        return {'phone': None, 'phone_code_hash': None, 'session_string': None, 'logged_in': False, 'user_info': None}
    return {'phone': r[0], 'phone_code_hash': r[1], 'session_string': r[2], 'logged_in': r[3], 'user_info': r[4]}


def save_state(phone=None, phone_code_hash=None, session_string=None, logged_in=None, user_info=None):
    parts = []
    if phone is not None: parts.append(f"phone='{esc(phone)}'")
    if phone_code_hash is not None: parts.append(f"phone_code_hash='{esc(phone_code_hash)}'")
    if session_string is not None: parts.append(f"session_string='{esc(session_string)}'")
    if logged_in is not None: parts.append(f"logged_in={'TRUE' if logged_in else 'FALSE'}")
    if user_info is not None: parts.append(f"user_info='{esc(json.dumps(user_info))}'::jsonb")
    parts.append("updated_at=NOW()")
    conn = db(); cur = conn.cursor()
    cur.execute(f"UPDATE {SCHEMA}.{SESSION_TABLE} SET {', '.join(parts)} WHERE id=1")
    conn.commit(); cur.close(); conn.close()


async def send_code(phone: str) -> dict:
    api_id = int(os.environ['TG_API_ID'])
    api_hash = os.environ['TG_API_HASH']
    client = TelegramClient(StringSession(), api_id, api_hash)
    await client.connect()
    try:
        sent = await client.send_code_request(phone)
        save_state(phone=phone, phone_code_hash=sent.phone_code_hash, session_string=client.session.save())
        return {'ok': True, 'phone_code_hash': sent.phone_code_hash}
    except PhoneNumberInvalidError:
        return {'ok': False, 'error': 'Неверный номер телефона'}
    except Exception as e:
        return {'ok': False, 'error': str(e)}
    finally:
        await client.disconnect()


async def verify_code(code: str) -> dict:
    state = get_state()
    if not state['phone'] or not state['phone_code_hash']:
        return {'ok': False, 'error': 'Сначала запроси код'}
    api_id = int(os.environ['TG_API_ID'])
    api_hash = os.environ['TG_API_HASH']
    client = TelegramClient(StringSession(state['session_string']), api_id, api_hash)
    await client.connect()
    try:
        await client.sign_in(phone=state['phone'], code=code, phone_code_hash=state['phone_code_hash'])
        me = await client.get_me()
        info = {'id': me.id, 'username': me.username, 'first_name': me.first_name}
        save_state(session_string=client.session.save(), logged_in=True, user_info=info)
        return {'ok': True, 'user': info}
    except SessionPasswordNeededError:
        save_state(session_string=client.session.save())
        return {'ok': False, 'need_2fa': True}
    except PhoneCodeInvalidError:
        return {'ok': False, 'error': 'Неверный код'}
    except Exception as e:
        return {'ok': False, 'error': str(e)}
    finally:
        await client.disconnect()


async def verify_2fa(password: str) -> dict:
    state = get_state()
    api_id = int(os.environ['TG_API_ID'])
    api_hash = os.environ['TG_API_HASH']
    client = TelegramClient(StringSession(state['session_string']), api_id, api_hash)
    await client.connect()
    try:
        await client.sign_in(password=password)
        me = await client.get_me()
        info = {'id': me.id, 'username': me.username, 'first_name': me.first_name}
        save_state(session_string=client.session.save(), logged_in=True, user_info=info)
        return {'ok': True, 'user': info}
    except Exception as e:
        return {'ok': False, 'error': str(e)}
    finally:
        await client.disconnect()


async def logout() -> dict:
    save_state(phone='', phone_code_hash='', session_string='', logged_in=False, user_info={})
    return {'ok': True}


def handler(event: dict, context) -> dict:
    """Логин второго user-аккаунта Telegram (для исключённых из @UG_DRIVER)."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {**CORS, 'Access-Control-Max-Age': '86400'}, 'body': ''}

    headers = event.get('headers') or {}
    token = headers.get('x-admin-token') or headers.get('X-Admin-Token') or ''
    if not verify_token(token):
        return resp(401, {'error': 'unauthorized'})

    method = event.get('httpMethod', 'GET')
    qs = event.get('queryStringParameters') or {}
    action = qs.get('action', '')

    if method == 'GET':
        s = get_state()
        return resp(200, {'logged_in': s['logged_in'], 'phone': s['phone'], 'user': s['user_info']})

    body = json.loads(event.get('body') or '{}')
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        if action == 'send_code':
            phone = body.get('phone', '').strip()
            if not phone:
                return resp(400, {'error': 'phone required'})
            return resp(200, loop.run_until_complete(send_code(phone)))
        if action == 'verify_code':
            return resp(200, loop.run_until_complete(verify_code(body.get('code', '').strip())))
        if action == 'verify_2fa':
            return resp(200, loop.run_until_complete(verify_2fa(body.get('password', ''))))
        if action == 'logout':
            return resp(200, loop.run_until_complete(logout()))
        return resp(400, {'error': 'unknown action'})
    finally:
        loop.close()
