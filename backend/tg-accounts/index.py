"""Пул user-аккаунтов Telegram для авто-приглашений.
GET                       — список аккаунтов
POST ?action=send_code    — отправить код на новый номер
POST ?action=verify_code  — подтвердить код, сохранить как новый аккаунт
POST ?action=verify_2fa   — подтвердить 2FA пароль
POST ?action=activate     — переключить активный аккаунт
POST ?action=delete       — удалить аккаунт
POST ?action=mark_banned  — пометить аккаунт как забаненный
POST ?action=update_label — переименовать аккаунт
POST ?action=join_group   — аккаунт вступает в @UG_DRIVER (id или all=true)
"""
import os
import json
import hashlib
import asyncio
import psycopg2

from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.tl.functions.channels import JoinChannelRequest
from telethon.tl.functions.messages import ImportChatInviteRequest, CheckChatInviteRequest
from telethon.errors import (
    SessionPasswordNeededError, PhoneCodeInvalidError, PhoneNumberInvalidError,
    UserAlreadyParticipantError, ChannelsTooMuchError, InviteHashExpiredError,
    FloodWaitError, ChannelPrivateError,
)


def get_target_group() -> str:
    """Читает целевую группу из app_settings."""
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL']); cur = conn.cursor()
        cur.execute(f"SELECT value FROM {os.environ.get('MAIN_DB_SCHEMA', 'public')}.app_settings WHERE key='target_group'")
        r = cur.fetchone(); cur.close(); conn.close()
        return (r[0] if r else '@UG_DRIVER').strip()
    except Exception:
        return '@UG_DRIVER'


def parse_invite_hash(s: str) -> str:
    """Из 't.me/+AbCdEf' или 't.me/joinchat/AbCdEf' достаёт hash. Иначе ''."""
    s = (s or '').strip()
    import re
    m = re.search(r'(?:t\.me/|telegram\.me/)\+([A-Za-z0-9_-]+)', s)
    if m:
        return m.group(1)
    m = re.search(r'(?:t\.me/|telegram\.me/)joinchat/([A-Za-z0-9_-]+)', s)
    if m:
        return m.group(1)
    if s.startswith('+'):
        return s[1:]
    return ''


def parse_username(s: str) -> str:
    """Из '@name' или 't.me/name' достаёт username. Иначе ''."""
    s = (s or '').strip().lstrip('@')
    import re
    m = re.search(r'(?:t\.me/|telegram\.me/)([A-Za-z][A-Za-z0-9_]{3,31})$', s)
    if m:
        return m.group(1)
    if re.match(r'^[A-Za-z][A-Za-z0-9_]{3,31}$', s):
        return s
    return ''

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
               daily_reset_date, last_used_at, created_at, notes,
               COALESCE(needs_warmup, TRUE)
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
        'needs_warmup': r[10],
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


def unban_account(account_id: int):
    """Снимает бан. Если account_id=0 — снимает со всех."""
    conn = db(); cur = conn.cursor()
    where = "TRUE" if account_id == 0 else f"id={account_id}"
    cur.execute(f"UPDATE {SCHEMA}.tg_user_accounts SET is_banned=FALSE WHERE {where}")
    conn.commit(); cur.close(); conn.close()


def reset_daily_invites(account_id: int):
    """Обнуляет дневной счётчик. Если account_id=0 — сбрасывает у всех."""
    conn = db(); cur = conn.cursor()
    where = "TRUE" if account_id == 0 else f"id={account_id}"
    cur.execute(f"""
        UPDATE {SCHEMA}.tg_user_accounts
        SET daily_invites_used=0, daily_reset_date=CURRENT_DATE
        WHERE {where}
    """)
    conn.commit(); cur.close(); conn.close()


def get_account_session(account_id: int) -> dict:
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        SELECT id, label, session_string, is_banned
        FROM {SCHEMA}.tg_user_accounts WHERE id={int(account_id)}
    """)
    r = cur.fetchone(); cur.close(); conn.close()
    if not r:
        return {}
    return {'id': r[0], 'label': r[1], 'session_string': r[2], 'is_banned': r[3]}


def get_all_account_ids() -> list:
    conn = db(); cur = conn.cursor()
    cur.execute(f"SELECT id FROM {SCHEMA}.tg_user_accounts WHERE is_banned=FALSE ORDER BY id ASC")
    rows = cur.fetchall(); cur.close(); conn.close()
    return [r[0] for r in rows]


async def join_group_one(account_id: int, target: str = '') -> dict:
    """Аккаунт вступает в группу. target: @username или t.me/+inviteHash."""
    acc = get_account_session(account_id)
    if not acc:
        return {'ok': False, 'error': 'Аккаунт не найден'}
    if acc['is_banned']:
        return {'ok': False, 'error': f'{acc["label"]}: аккаунт помечен забаненным'}

    target = (target or get_target_group()).strip()
    invite_hash = parse_invite_hash(target)
    username = parse_username(target) if not invite_hash else ''

    api_id = int(os.environ['TG_API_ID'])
    api_hash = os.environ['TG_API_HASH']
    client = TelegramClient(StringSession(acc['session_string']), api_id, api_hash)
    await client.connect()
    try:
        if not await client.is_user_authorized():
            return {'ok': False, 'account_id': account_id, 'label': acc['label'],
                    'error': 'Сессия невалидна'}
        try:
            if invite_hash:
                # приватная группа по invite-ссылке
                try:
                    await client(ImportChatInviteRequest(invite_hash))
                    return {'ok': True, 'account_id': account_id, 'label': acc['label'],
                            'status': 'joined', 'group': target}
                except UserAlreadyParticipantError:
                    return {'ok': True, 'account_id': account_id, 'label': acc['label'],
                            'status': 'already_in', 'group': target}
            elif username:
                # публичная группа по username
                try:
                    entity = await client.get_entity(username)
                except Exception as e:
                    return {'ok': False, 'account_id': account_id, 'label': acc['label'],
                            'error': f'@{username} не найден в Telegram. Проверь правильность ссылки.'}
                try:
                    await client(JoinChannelRequest(entity))
                    return {'ok': True, 'account_id': account_id, 'label': acc['label'],
                            'status': 'joined', 'group': f'@{username}'}
                except UserAlreadyParticipantError:
                    return {'ok': True, 'account_id': account_id, 'label': acc['label'],
                            'status': 'already_in', 'group': f'@{username}'}
            else:
                return {'ok': False, 'account_id': account_id, 'label': acc['label'],
                        'error': f'Не понял формат: "{target}". Нужно @username или t.me/+invite'}
        except FloodWaitError as fw:
            return {'ok': False, 'account_id': account_id, 'label': acc['label'],
                    'error': f'FloodWait {fw.seconds} сек'}
        except (ChannelsTooMuchError, ChannelPrivateError, InviteHashExpiredError) as e:
            return {'ok': False, 'account_id': account_id, 'label': acc['label'],
                    'error': type(e).__name__}
        except Exception as e:
            return {'ok': False, 'account_id': account_id, 'label': acc['label'],
                    'error': str(e)[:200]}
    finally:
        await client.disconnect()


async def join_group_all(target: str = '') -> dict:
    """Все не забаненные аккаунты вступают в группу."""
    ids = get_all_account_ids()
    results = []
    for i, aid in enumerate(ids):
        r = await join_group_one(aid, target)
        results.append(r)
        if i < len(ids) - 1:
            await asyncio.sleep(3)
    return {'ok': True, 'total': len(results), 'results': results, 'target': target or get_target_group()}


async def check_target(target: str = '') -> dict:
    """Диагностика: что находится по ссылке/username. Использует первый рабочий аккаунт."""
    target = (target or get_target_group()).strip()
    invite_hash = parse_invite_hash(target)
    username = parse_username(target) if not invite_hash else ''

    ids = get_all_account_ids()
    if not ids:
        return {'ok': False, 'error': 'Нет рабочих аккаунтов для проверки'}

    acc = get_account_session(ids[0])
    api_id = int(os.environ['TG_API_ID'])
    api_hash = os.environ['TG_API_HASH']
    client = TelegramClient(StringSession(acc['session_string']), api_id, api_hash)
    await client.connect()
    try:
        if not await client.is_user_authorized():
            return {'ok': False, 'error': f'Сессия аккаунта «{acc["label"]}» невалидна'}

        if invite_hash:
            try:
                info = await client(CheckChatInviteRequest(invite_hash))
                title = getattr(info, 'title', None) or getattr(getattr(info, 'chat', None), 'title', '?')
                return {
                    'ok': True, 'mode': 'invite_link', 'title': title,
                    'can_invite': True,
                    'message': f'Приватная группа «{title}» — по invite-ссылке вступать можно. Прямой инвайт работает только если ты участник.',
                }
            except Exception as e:
                return {'ok': False, 'error': f'Invite-ссылка невалидна: {type(e).__name__}: {e}'}

        if not username:
            return {'ok': False, 'error': f'Не понял формат: "{target}"'}

        try:
            entity = await client.get_entity(username)
        except Exception as e:
            return {'ok': False, 'error': f'@{username} не найден: {type(e).__name__}'}

        # Что за объект — канал, мегагруппа, юзер?
        from telethon.tl.types import Channel, Chat, User
        if isinstance(entity, User):
            return {
                'ok': False,
                'mode': 'user',
                'title': f'{entity.first_name or ""} {entity.last_name or ""}'.strip() or f'@{username}',
                'can_invite': False,
                'message': f'@{username} — это пользователь Telegram, а не группа. Инвайт сюда невозможен.',
            }
        if isinstance(entity, Channel):
            is_megagroup = bool(getattr(entity, 'megagroup', False))
            is_broadcast = bool(getattr(entity, 'broadcast', False))
            participants = getattr(entity, 'participants_count', None)
            if is_broadcast and not is_megagroup:
                return {
                    'ok': False,
                    'mode': 'channel',
                    'title': entity.title,
                    'participants': participants,
                    'can_invite': False,
                    'message': (f'❌ «{entity.title}» — это КАНАЛ ({participants} подписчиков), а не группа-чат. '
                                f'Telegram запрещает массово добавлять подписчиков в каналы. '
                                f'Найди связанный с каналом ЧАТ-обсуждение (group/megagroup) и используй его username.'),
                }
            return {
                'ok': True,
                'mode': 'megagroup' if is_megagroup else 'group',
                'title': entity.title,
                'participants': participants,
                'can_invite': True,
                'message': f'✅ «{entity.title}» — это группа ({participants} участников). Инвайт работает.',
            }
        if isinstance(entity, Chat):
            return {
                'ok': True, 'mode': 'small_group', 'title': entity.title,
                'can_invite': True,
                'message': f'✅ «{entity.title}» — обычная маленькая группа. Инвайт работает.',
            }
        return {'ok': False, 'error': f'Неизвестный тип сущности: {type(entity).__name__}'}
    finally:
        await client.disconnect()


def set_target_group(value: str):
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        INSERT INTO {SCHEMA}.app_settings (key, value, updated_at)
        VALUES ('target_group', '{esc(value)}', NOW())
        ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()
    """)
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
        return resp(200, {'accounts': list_accounts(), 'target_group': get_target_group()})

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
    if action == 'unban':
        unban_account(int(body.get('id', 0)))
        return resp(200, {'ok': True, 'accounts': list_accounts()})
    if action == 'reset_daily':
        reset_daily_invites(int(body.get('id', 0)))
        return resp(200, {'ok': True, 'accounts': list_accounts()})
    if action == 'update_label':
        update_label(int(body.get('id', 0)), body.get('label', ''))
        return resp(200, {'ok': True, 'accounts': list_accounts()})
    if action == 'set_target':
        val = (body.get('target') or '').strip()
        if not val:
            return resp(400, {'error': 'target required'})
        set_target_group(val)
        return resp(200, {'ok': True, 'target_group': get_target_group()})
    if action == 'toggle_warmup':
        account_id = int(body.get('id', 0))
        needs = bool(body.get('needs_warmup', True))
        if not account_id:
            return resp(400, {'error': 'id required'})
        conn = db(); cur = conn.cursor()
        cur.execute(f"UPDATE {SCHEMA}.tg_user_accounts SET needs_warmup={'TRUE' if needs else 'FALSE'} WHERE id={account_id}")
        conn.commit(); cur.close(); conn.close()
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
        if action == 'join_group':
            target = (body.get('target') or '').strip()
            if body.get('all') is True:
                return resp(200, loop.run_until_complete(join_group_all(target)))
            account_id = int(body.get('id', 0))
            if not account_id:
                return resp(400, {'error': 'id required (или all=true)'})
            return resp(200, loop.run_until_complete(join_group_one(account_id, target)))
        if action == 'check_target':
            target = (body.get('target') or '').strip()
            return resp(200, loop.run_until_complete(check_target(target)))
        return resp(400, {'error': 'unknown action'})
    finally:
        loop.close()