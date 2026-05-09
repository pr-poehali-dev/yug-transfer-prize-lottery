"""Пул user-аккаунтов Telegram для авто-приглашений.
GET                       — список аккаунтов
POST ?action=send_code    — отправить код на новый номер
POST ?action=verify_code  — подтвердить код, сохранить как новый аккаунт
POST ?action=verify_2fa   — подтвердить 2FA пароль
POST ?action=activate     — переключить активный аккаунт
POST ?action=delete       — удалить аккаунт
POST ?action=mark_banned  — пометить аккаунт как забаненный
POST ?action=update_label — переименовать аккаунт
"""
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


def list_accounts() -> list:
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        SELECT id, label, phone, is_active, is_banned, daily_invites_used,
               daily_reset_date, last_used_at, created_at, notes
        FROM {SCHEMA}.tg_user_accounts ORDER BY id ASC
    """)
    rows = cur.fetchall()
    cur.close(); conn.close()
    return [{
        'id': r[0], 'label': r[1], 'phone': r[2],
        'is_active': r[3], 'is_banned': r[4],
        'daily_invites_used': r[5], 'daily_reset_date': str(r[6]) if r[6] else None,
        'last_used_at': str(r[7]) if r[7] else None,
        'created_at': str(r[8]) if r[8] else None,
        'notes': r[9] or '',
    } for r in rows]


def save_login_session(phone: str, phone_code_hash: str, session_string: str):
    conn = db(); cur = conn.cursor()
    cur.execute(f"DELETE FROM {SCHEMA}.tg_account_login_sessions WHERE phone='{esc(phone)}'")
    cur.execute(f"""
        INSERT INTO {SCHEMA}.tg_account_login_sessions (phone, phone_code_hash, session_string)
        VALUES ('{esc(phone)}', '{esc(phone_code_hash)}', '{esc(session_string)}')
    """)
    conn.commit(); cur.close(); conn.close()


def get_login_session(phone: str) -> dict:
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        SELECT phone_code_hash, session_string FROM {SCHEMA}.tg_account_login_sessions
        WHERE phone='{esc(phone)}' ORDER BY id DESC LIMIT 1
    """)
    r = cur.fetchone(); cur.close(); conn.close()
    if not r:
        return {}
    return {'phone_code_hash': r[0], 'session_string': r[1]}


def delete_login_session(phone: str):
    conn = db(); cur = conn.cursor()
    cur.execute(f"DELETE FROM {SCHEMA}.tg_account_login_sessions WHERE phone='{esc(phone)}'")
    conn.commit(); cur.close(); conn.close()


def add_account(label: str, phone: str, session_string: str) -> int:
    conn = db(); cur = conn.cursor()
    cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.tg_user_accounts")
    cnt = cur.fetchone()[0]
    is_active = 'TRUE' if cnt == 0 else 'FALSE'
    cur.execute(f"""
        INSERT INTO {SCHEMA}.tg_user_accounts (label, phone, session_string, is_active)
        VALUES ('{esc(label)}', '{esc(phone)}', '{esc(session_string)}', {is_active})
        RETURNING id
    """)
    new_id = cur.fetchone()[0]
    conn.commit(); cur.close(); conn.close()
    return new_id


async def send_code(phone: str) -> dict:
    api_id = int(os.environ['TG_API_ID'])
    api_hash = os.environ['TG_API_HASH']
    client = TelegramClient(StringSession(), api_id, api_hash)
    await client.connect()
    try:
        sent = await client.send_code_request(phone)
        save_login_session(phone, sent.phone_code_hash, client.session.save())
        return {'ok': True}
    except PhoneNumberInvalidError:
        return {'ok': False, 'error': 'Неверный номер телефона'}
    except Exception as e:
        return {'ok': False, 'error': str(e)}
    finally:
        await client.disconnect()


async def verify_code(phone: str, code: str, label: str) -> dict:
    sess = get_login_session(phone)
    if not sess:
        return {'ok': False, 'error': 'Сначала запроси код'}
    api_id = int(os.environ['TG_API_ID'])
    api_hash = os.environ['TG_API_HASH']
    client = TelegramClient(StringSession(sess['session_string']), api_id, api_hash)
    await client.connect()
    try:
        await client.sign_in(phone=phone, code=code, phone_code_hash=sess['phone_code_hash'])
        me = await client.get_me()
        final_session = client.session.save()
        delete_login_session(phone)
        nice_label = label or me.first_name or me.username or phone
        new_id = add_account(nice_label, phone, final_session)
        return {'ok': True, 'id': new_id, 'user': {'id': me.id, 'username': me.username, 'first_name': me.first_name}}
    except SessionPasswordNeededError:
        save_login_session(phone, sess['phone_code_hash'], client.session.save())
        return {'ok': False, 'need_2fa': True}
    except PhoneCodeInvalidError:
        return {'ok': False, 'error': 'Неверный код'}
    except Exception as e:
        return {'ok': False, 'error': str(e)}
    finally:
        await client.disconnect()


async def verify_2fa(phone: str, password: str, label: str) -> dict:
    sess = get_login_session(phone)
    if not sess:
        return {'ok': False, 'error': 'Сначала запроси код'}
    api_id = int(os.environ['TG_API_ID'])
    api_hash = os.environ['TG_API_HASH']
    client = TelegramClient(StringSession(sess['session_string']), api_id, api_hash)
    await client.connect()
    try:
        await client.sign_in(password=password)
        me = await client.get_me()
        final_session = client.session.save()
        delete_login_session(phone)
        nice_label = label or me.first_name or me.username or phone
        new_id = add_account(nice_label, phone, final_session)
        return {'ok': True, 'id': new_id, 'user': {'id': me.id, 'username': me.username, 'first_name': me.first_name}}
    except Exception as e:
        return {'ok': False, 'error': str(e)}
    finally:
        await client.disconnect()


def activate_account(account_id: int):
    conn = db(); cur = conn.cursor()
    cur.execute(f"UPDATE {SCHEMA}.tg_user_accounts SET is_active=FALSE")
    cur.execute(f"UPDATE {SCHEMA}.tg_user_accounts SET is_active=TRUE, is_banned=FALSE WHERE id={account_id}")
    conn.commit(); cur.close(); conn.close()


def delete_account(account_id: int):
    conn = db(); cur = conn.cursor()
    cur.execute(f"DELETE FROM {SCHEMA}.tg_user_accounts WHERE id={account_id}")
    cur.execute(f"SELECT id FROM {SCHEMA}.tg_user_accounts WHERE is_active=TRUE LIMIT 1")
    if not cur.fetchone():
        cur.execute(f"UPDATE {SCHEMA}.tg_user_accounts SET is_active=TRUE WHERE id=(SELECT MIN(id) FROM {SCHEMA}.tg_user_accounts)")
    conn.commit(); cur.close(); conn.close()


def mark_banned(account_id: int, note: str = ''):
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        UPDATE {SCHEMA}.tg_user_accounts
        SET is_banned=TRUE, is_active=FALSE, notes='{esc(note or 'Помечен забаненным')}'
        WHERE id={account_id}
    """)
    cur.execute(f"""
        UPDATE {SCHEMA}.tg_user_accounts SET is_active=TRUE
        WHERE id=(SELECT id FROM {SCHEMA}.tg_user_accounts WHERE is_banned=FALSE ORDER BY id LIMIT 1)
    """)
    conn.commit(); cur.close(); conn.close()


def update_label(account_id: int, label: str):
    conn = db(); cur = conn.cursor()
    cur.execute(f"UPDATE {SCHEMA}.tg_user_accounts SET label='{esc(label)}' WHERE id={account_id}")
    conn.commit(); cur.close(); conn.close()


def handler(event: dict, context) -> dict:
    """Управление пулом user-аккаунтов Telegram для авто-приглашений."""
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
        return resp(200, {'accounts': list_accounts()})

    body = json.loads(event.get('body') or '{}')

    if action == 'activate':
        activate_account(int(body.get('id', 0)))
        return resp(200, {'ok': True, 'accounts': list_accounts()})
    if action == 'delete':
        delete_account(int(body.get('id', 0)))
        return resp(200, {'ok': True, 'accounts': list_accounts()})
    if action == 'mark_banned':
        mark_banned(int(body.get('id', 0)), body.get('note', ''))
        return resp(200, {'ok': True, 'accounts': list_accounts()})
    if action == 'update_label':
        update_label(int(body.get('id', 0)), body.get('label', ''))
        return resp(200, {'ok': True, 'accounts': list_accounts()})

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        if action == 'send_code':
            phone = body.get('phone', '').strip()
            if not phone:
                return resp(400, {'error': 'phone required'})
            return resp(200, loop.run_until_complete(send_code(phone)))
        if action == 'verify_code':
            phone = body.get('phone', '').strip()
            code = body.get('code', '').strip()
            label = body.get('label', '').strip()
            return resp(200, loop.run_until_complete(verify_code(phone, code, label)))
        if action == 'verify_2fa':
            phone = body.get('phone', '').strip()
            password = body.get('password', '')
            label = body.get('label', '').strip()
            return resp(200, loop.run_until_complete(verify_2fa(phone, password, label)))
        return resp(400, {'error': 'unknown action'})
    finally:
        loop.close()
