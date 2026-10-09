"""
Поиск аккаунта Telegram по @username через подключённый user-аккаунт.
GET ?username=name или ?phone=79991234567 — возвращает Telegram ID, имя, username, телефон (если открыт), описание и фото.
"""
import os
import json
import uuid
import asyncio
import hashlib
import psycopg2
import boto3
from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.tl.functions.users import GetFullUserRequest
from telethon.tl.functions.contacts import ImportContactsRequest, DeleteContactsRequest
from telethon.tl.types import InputPhoneContact
from telethon.tl.types import User

SCHEMA = 't_p67171637_yug_transfer_prize_l'
CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
}


def resp(code: int, data: dict) -> dict:
    return {'statusCode': code, 'headers': {**CORS, 'Content-Type': 'application/json'},
            'body': json.dumps(data, ensure_ascii=False, default=str)}


def verify_token(token: str) -> bool:
    if not token:
        return False
    a = hashlib.sha256(f"{os.environ.get('ADMIN_LOGIN', '')}:{os.environ.get('ADMIN_PASSWORD', '')}:admin_secret_2026".encode()).hexdigest()
    pl = os.environ.get('POSTS_LOGIN', '')
    p = hashlib.sha256(f"{pl}:{os.environ.get('POSTS_PASSWORD', '')}:posts_secret_2026".encode()).hexdigest()
    return token == a or (bool(pl) and token == p)


def clean_username(v: str) -> str:
    v = (v or '').strip()
    for pref in ('https://t.me/', 'http://t.me/', 't.me/'):
        if v.lower().startswith(pref):
            v = v[len(pref):]
    return v.strip('/').lstrip('@').split('?')[0]


def load_sessions(cur) -> list:
    cur.execute(f"SELECT session_string FROM {SCHEMA}.tg_user_accounts "
                f"WHERE coalesce(session_string, '') <> '' AND NOT coalesce(is_banned, FALSE) "
                f"ORDER BY is_active DESC, last_used_at DESC NULLS LAST")
    sessions = [r[0] for r in cur.fetchall()]
    cur.execute(f"SELECT session_string FROM {SCHEMA}.tg_user_session WHERE coalesce(session_string, '') <> ''")
    sessions += [r[0] for r in cur.fetchall()]
    return sessions


def store_photo(raw: bytes) -> str:
    key = f"check-lists/tg-{uuid.uuid4().hex}.jpg"
    s3 = boto3.client('s3', endpoint_url='https://bucket.poehali.dev',
                      aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
                      aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'])
    s3.put_object(Bucket='files', Key=key, Body=raw, ContentType='image/jpeg')
    return f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"


async def resolve_phone(client, phone: str):
    """Находит аккаунт по номеру: временно добавляем в контакты и сразу удаляем."""
    res = await client(ImportContactsRequest([InputPhoneContact(client_id=0, phone=phone, first_name='check', last_name='')]))
    if not res.users:
        return None
    user = res.users[0]
    try:
        await client(DeleteContactsRequest(id=[user]))
    except Exception as e:
        print(f'[TG-LOOKUP] delete contact failed: {type(e).__name__}')
    return user


async def lookup(session: str, username: str, phone: str = '') -> dict:
    client = TelegramClient(StringSession(session), int(os.environ['TG_API_ID']), os.environ['TG_API_HASH'],
                            connection_retries=1, timeout=8)
    await client.connect()
    try:
        if not await client.is_user_authorized():
            return {'retry': True, 'error': 'session not authorized'}
        if phone:
            entity = await resolve_phone(client, phone)
            if entity is None:
                return {'error': 'По этому номеру аккаунт не найден или скрыт настройками приватности'}
        else:
            entity = await client.get_entity(username)
        if not isinstance(entity, User):
            return {'error': 'Это не личный аккаунт, а группа или канал'}
        bio = ''
        try:
            full = await client(GetFullUserRequest(entity))
            bio = getattr(full.full_user, 'about', '') or ''
        except Exception as e:
            print(f'[TG-LOOKUP] full user failed: {type(e).__name__}')
        photo_url, photo_uid = '', ''
        if entity.photo and getattr(entity.photo, 'photo_id', None):
            raw = await client.download_profile_photo(entity, file=bytes)
            if raw:
                photo_url = store_photo(raw)
                photo_uid = str(entity.photo.photo_id)
        return {
            'tg_id': entity.id,
            'username': entity.username or username or '',
            'name': ' '.join(x for x in [entity.first_name or '', entity.last_name or ''] if x).strip(),
            'phone': f"+{entity.phone}" if entity.phone else (f"+{phone}" if phone else ''),
            'bio': bio,
            'photo_url': photo_url,
            'photo_uid': photo_uid,
            'is_bot': bool(entity.bot),
            'deleted': bool(entity.deleted),
        }
    except ValueError:
        return {'error': 'Аккаунт с таким username не найден'}
    except Exception as e:
        name = type(e).__name__
        print(f'[TG-LOOKUP] {name}: {e}')
        if 'UsernameNotOccupied' in name or 'UsernameInvalid' in name:
            return {'error': 'Аккаунт с таким username не найден'}
        return {'retry': True, 'error': name}
    finally:
        await client.disconnect()


def save_cache(cur, d: dict) -> None:
    def q(v):
        return str(v or '').replace("'", "''")
    first, _, last = d['name'].partition(' ')
    cur.execute(
        f"INSERT INTO {SCHEMA}.tg_users (tg_id, username, first_name, last_name, phone, source) "
        f"VALUES ({int(d['tg_id'])}, '{q(d['username'])}', '{q(first)}', '{q(last)}', '{q(d['phone'])}', 'lookup') "
        f"ON CONFLICT (tg_id) DO UPDATE SET username=EXCLUDED.username, first_name=EXCLUDED.first_name, "
        f"last_name=EXCLUDED.last_name, phone=CASE WHEN EXCLUDED.phone <> '' THEN EXCLUDED.phone ELSE {SCHEMA}.tg_users.phone END, "
        f"updated_at=now()")


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    headers = event.get('headers') or {}
    if not verify_token(headers.get('X-Admin-Token') or headers.get('x-admin-token') or ''):
        return resp(401, {'error': 'Unauthorized'})

    qs = event.get('queryStringParameters') or {}
    username = clean_username(qs.get('username', ''))
    phone = ''.join(ch for ch in str(qs.get('phone') or '') if ch.isdigit())
    if len(phone) == 11 and phone[0] == '8':
        phone = '7' + phone[1:]
    elif len(phone) == 10 and phone[0] == '9':
        phone = '7' + phone
    if not phone and len(username) < 4:
        return resp(400, {'ok': False, 'error': 'Укажите @username или номер телефона'})

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        sessions = load_sessions(cur)
        if not sessions:
            return resp(200, {'ok': False, 'error': 'Нет подключённого Telegram-аккаунта'})
        result = {'error': 'Не удалось получить данные'}
        for s in sessions[:3]:
            result = asyncio.run(lookup(s, '' if phone else username, phone))
            if not result.get('retry'):
                break
        if not result.get('tg_id'):
            return resp(200, {'ok': False, 'error': result.get('error', 'Не найдено')})
        save_cache(cur, result)
        conn.commit()
        return resp(200, {'ok': True, **result})
    finally:
        cur.close()
        conn.close()
