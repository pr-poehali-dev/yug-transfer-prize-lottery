"""Рассылка в личные сообщения через user-аккаунты Telethon.
Общий текст + одно фото на всех. Список получателей засевается из invite_targets
и распределяется по аккаунтам (каждый аккаунт пишет своим закреплённым кандидатам).

GET                          — статус (счётчики очереди + аккаунты + текущее сообщение)
POST ?action=save_message    — сохранить текст + фото (фото base64 -> S3), {text, photo_base64?, photo_ext?}
POST ?action=seed            — засеять очередь рассылки из invite_targets (распределяя по аккаунтам)
POST ?action=clear           — очистить очередь рассылки
POST ?action=run_account     — отправить пачку с одного аккаунта его получателям, {account_id, size}
"""
import os
import io
import json
import hashlib
import base64
import asyncio
import random
import time
import uuid
import psycopg2

import boto3
from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.errors import (
    FloodWaitError, UserPrivacyRestrictedError, PeerFloodError,
    UsernameInvalidError, UsernameNotOccupiedError,
    InputUserDeactivatedError,
)

try:
    from telethon.errors import UserIsBlockedError
except Exception:
    class UserIsBlockedError(Exception):
        pass
try:
    from telethon.errors import UserDeactivatedError
except Exception:
    class UserDeactivatedError(Exception):
        pass

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
}
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')

DM_RUN_MAX = 7            # макс сообщений за один HTTP-запуск с одного аккаунта (таймаут 30с)
TIME_BUDGET_SEC = 22      # бюджет времени на пачку
DM_CLICK_TOTAL = 20       # сколько сообщений уходит за одно нажатие «Отправить» (несколько HTTP-пачек)


def verify_token(token: str) -> bool:
    admin_login = os.environ.get('ADMIN_LOGIN', '')
    admin_password = os.environ.get('ADMIN_PASSWORD', '')
    base = f"{admin_login}:{admin_password}:admin_secret_2026"
    return token == hashlib.sha256(base.encode()).hexdigest()


def esc(value) -> str:
    if value is None:
        return ''
    return str(value).replace("'", "''")


def resp(status: int, body: dict) -> dict:
    return {'statusCode': status, 'headers': CORS, 'body': json.dumps(body, default=str)}


def db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


# ---------- message (text + photo) ----------

def get_message() -> dict:
    conn = db(); cur = conn.cursor()
    cur.execute(f"SELECT text, photo_url FROM {SCHEMA}.dm_message WHERE id=1")
    r = cur.fetchone(); cur.close(); conn.close()
    if not r:
        return {'text': '', 'photo_url': ''}
    return {'text': r[0] or '', 'photo_url': r[1] or ''}


def save_message(text: str, photo_url: str) -> None:
    conn = db(); cur = conn.cursor()
    cur.execute(
        f"UPDATE {SCHEMA}.dm_message SET text='{esc(text)}', photo_url='{esc(photo_url)}', updated_at=NOW() WHERE id=1"
    )
    conn.commit(); cur.close(); conn.close()


def upload_photo(photo_base64: str, ext: str = 'jpg') -> str:
    data = base64.b64decode(photo_base64)
    key = f"dm_photos/{uuid.uuid4().hex}.{ext}"
    s3 = boto3.client(
        's3', endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    )
    content_type = 'image/png' if ext == 'png' else 'image/jpeg'
    s3.put_object(Bucket='files', Key=key, Body=data, ContentType=content_type)
    return f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"


# ---------- accounts ----------

def get_accounts() -> list:
    """Все незабаненные аккаунты с валидной сессией + кол-во ожидающих получателей у каждого."""
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        SELECT a.id, a.label, a.is_banned, a.is_active,
               COALESCE(p.cnt, 0) AS pending_cnt
        FROM {SCHEMA}.tg_user_accounts a
        LEFT JOIN (
            SELECT assigned_account_id, COUNT(*) cnt
            FROM {SCHEMA}.dm_targets
            WHERE status='pending'
            GROUP BY assigned_account_id
        ) p ON p.assigned_account_id = a.id
        WHERE a.session_string IS NOT NULL AND a.session_string <> ''
        ORDER BY a.id ASC
    """)
    rows = cur.fetchall(); cur.close(); conn.close()
    return [{
        'id': r[0], 'label': r[1], 'is_banned': r[2], 'is_active': r[3],
        'pending': int(r[4] or 0),
    } for r in rows]


def get_account_session(account_id: int):
    conn = db(); cur = conn.cursor()
    cur.execute(
        f"SELECT id, label, session_string, is_banned FROM {SCHEMA}.tg_user_accounts WHERE id={int(account_id)} LIMIT 1"
    )
    r = cur.fetchone(); cur.close(); conn.close()
    if not r:
        return None
    return {'id': r[0], 'label': r[1], 'session_string': r[2], 'is_banned': r[3]}


# ---------- queue ----------

def get_counts() -> dict:
    conn = db(); cur = conn.cursor()
    cur.execute(f"SELECT status, COUNT(*) FROM {SCHEMA}.dm_targets GROUP BY status")
    rows = cur.fetchall(); cur.close(); conn.close()
    d = {r[0]: int(r[1]) for r in rows}
    return {
        'pending': d.get('pending', 0),
        'sent': d.get('sent', 0),
        'privacy': d.get('privacy', 0),
        'failed': d.get('failed', 0),
        'in_progress': d.get('in_progress', 0),
        'total': sum(d.values()),
    }


def seed_from_invites() -> dict:
    """Копирует юзернеймы из invite_targets в очередь рассылки, сохраняя закрепление
    за аккаунтом (assigned_account_id). Дубликаты игнорируются."""
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        INSERT INTO {SCHEMA}.dm_targets (username, assigned_account_id, status)
        SELECT DISTINCT ON (lower(t.username)) t.username, t.assigned_account_id, 'pending'
        FROM {SCHEMA}.invite_targets t
        WHERE t.username IS NOT NULL AND t.username <> ''
          AND length(t.username) >= 5
          AND t.username ~ '^[A-Za-z][A-Za-z0-9_]{{4,31}}$'
        ORDER BY lower(t.username), t.id ASC
        ON CONFLICT (lower(username)) DO NOTHING
    """)
    inserted = cur.rowcount
    conn.commit(); cur.close(); conn.close()
    return {'inserted': inserted}


def clear_queue() -> int:
    conn = db(); cur = conn.cursor()
    cur.execute(f"DELETE FROM {SCHEMA}.dm_targets")
    n = cur.rowcount
    conn.commit(); cur.close(); conn.close()
    return n


# Регулярка валидного Telegram-юзернейма: 5-32 символа, начинается с буквы,
# дальше латиница/цифры/подчёркивание.
VALID_USERNAME_RE = "^[A-Za-z][A-Za-z0-9_]{4,31}$"


def clean_invalid() -> int:
    """Удаляет из очереди записи без корректного юзернейма (короткие/мусорные/пустые)."""
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        DELETE FROM {SCHEMA}.dm_targets
        WHERE username IS NULL
           OR username = ''
           OR length(username) < 5
           OR username !~ '{VALID_USERNAME_RE}'
    """)
    n = cur.rowcount
    conn.commit(); cur.close(); conn.close()
    return n


def reserve_dm_targets(limit: int, account_id: int) -> list:
    """Атомарно резервирует получателей закреплённых за аккаунтом (pending -> in_progress).
    Если своих не хватает — добирает незакреплённых (assigned IS NULL)."""
    conn = db(); cur = conn.cursor()
    # сброс зависших старше 10 минут
    cur.execute(f"""
        UPDATE {SCHEMA}.dm_targets SET status='pending'
        WHERE status='in_progress' AND id IN (
            SELECT id FROM {SCHEMA}.dm_targets WHERE status='in_progress' ORDER BY id ASC LIMIT 200
        ) AND NOT EXISTS (
            SELECT 1 FROM {SCHEMA}.dm_targets WHERE status='in_progress' AND sent_at > NOW() - INTERVAL '10 minutes'
        )
    """)
    conn.commit()

    def pick(flt: str, lim: int) -> list:
        cur.execute(f"""
            WITH picked AS (
                SELECT id FROM {SCHEMA}.dm_targets
                WHERE status='pending' AND username IS NOT NULL AND username <> '' {flt}
                ORDER BY id ASC LIMIT {int(lim)} FOR UPDATE SKIP LOCKED
            )
            UPDATE {SCHEMA}.dm_targets t SET status='in_progress'
            FROM picked WHERE t.id=picked.id
            RETURNING t.id, t.username
        """)
        out = cur.fetchall(); conn.commit()
        return [{'id': r[0], 'username': r[1]} for r in out]

    targets = pick(f"AND assigned_account_id={int(account_id)}", limit)
    if len(targets) < limit:
        targets += pick("AND assigned_account_id IS NULL", limit - len(targets))
    cur.close(); conn.close()
    return targets


def update_dm_target(target_id: int, status: str, error: str, account_id: int) -> None:
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        UPDATE {SCHEMA}.dm_targets
        SET status='{esc(status)}', error='{esc(error[:300])}',
            sent_at = CASE WHEN '{esc(status)}'='sent' THEN NOW() ELSE sent_at END,
            sent_by_account_id={int(account_id)}
        WHERE id={int(target_id)}
    """)
    conn.commit(); cur.close(); conn.close()


def release_dm_targets(ids: list) -> None:
    ids = [int(i) for i in ids if i]
    if not ids:
        return
    conn = db(); cur = conn.cursor()
    cur.execute(
        f"UPDATE {SCHEMA}.dm_targets SET status='pending' "
        f"WHERE status='in_progress' AND id IN ({','.join(str(i) for i in ids)})"
    )
    conn.commit(); cur.close(); conn.close()


# ---------- sending ----------

async def download_photo(photo_url: str) -> bytes:
    if not photo_url:
        return b''
    import urllib.request
    try:
        with urllib.request.urlopen(photo_url, timeout=15) as r:
            return r.read()
    except Exception:
        return b''


async def run_account_dm(account_id: int, size: int) -> dict:
    acc = get_account_session(account_id)
    if not acc:
        return {'ok': False, 'error': 'Аккаунт не найден'}
    if acc['is_banned']:
        return {'ok': False, 'error': f'Аккаунт «{acc["label"]}» помечен забаненным'}

    msg = get_message()
    if not (msg['text'] or msg['photo_url']):
        return {'ok': False, 'error': 'Сначала заполни текст или фото рассылки'}

    take = max(1, min(size, DM_RUN_MAX))
    targets = reserve_dm_targets(take, account_id)
    if not targets:
        return {'ok': True, 'account': acc['label'], 'sent': 0, 'privacy': 0, 'failed': 0, 'empty': True}

    func_start = time.time()
    api_id = int(os.environ['TG_API_ID'])
    api_hash = os.environ['TG_API_HASH']

    photo_bytes = await download_photo(msg['photo_url'])
    photo_name = 'photo.png' if str(msg['photo_url']).lower().endswith('.png') else 'photo.jpg'

    client = TelegramClient(StringSession(acc['session_string']), api_id, api_hash)
    sent = 0; privacy = 0; failed = 0; peer_flood = False
    try:
        authorized = False
        ever_connected = False
        for _ in range(5):
            try:
                if not client.is_connected():
                    await client.connect()
                ever_connected = True
                if await client.is_user_authorized():
                    authorized = True
                    break
            except Exception:
                try:
                    await client.disconnect()
                except Exception:
                    pass
            await asyncio.sleep(1.5)
        if not authorized:
            release_dm_targets([t['id'] for t in targets])
            if ever_connected:
                return {'ok': False, 'account': acc['label'], 'session_dead': True,
                        'error': f'Сессия аккаунта «{acc["label"]}» слетела. Переподключи аккаунт заново.'}
            return {'ok': False, 'account': acc['label'],
                    'error': 'Telegram не поднял соединение (временный сбой), попробуй ещё раз'}

        for i, t in enumerate(targets):
            if time.time() - func_start > TIME_BUDGET_SEC:
                break
            uname = t['username']
            try:
                entity = await client.get_entity(uname)
                if photo_bytes:
                    # Отправляем именно как фото (с превью), а не файлом-документом.
                    bio = io.BytesIO(photo_bytes)
                    bio.name = photo_name
                    await client.send_file(
                        entity, bio,
                        caption=msg['text'] or None,
                        force_document=False,
                    )
                else:
                    await client.send_message(entity, msg['text'])
                update_dm_target(t['id'], 'sent', '', acc['id'])
                sent += 1
            except (UsernameInvalidError, UsernameNotOccupiedError, ValueError):
                update_dm_target(t['id'], 'failed', 'username не существует', acc['id'])
                failed += 1
            except UserPrivacyRestrictedError:
                update_dm_target(t['id'], 'privacy', 'нельзя писать (приватность)', acc['id'])
                privacy += 1
            except UserIsBlockedError:
                update_dm_target(t['id'], 'failed', 'пользователь заблокировал', acc['id'])
                failed += 1
            except (InputUserDeactivatedError, UserDeactivatedError):
                update_dm_target(t['id'], 'failed', 'аккаунт удалён', acc['id'])
                failed += 1
            except PeerFloodError:
                # Лимит Telegram на сообщения — НЕ бан. Останавливаем пачку, кандидата вернём.
                update_dm_target(t['id'], 'pending', 'PEER_FLOOD — вернули в очередь', acc['id'])
                peer_flood = True
                break
            except FloodWaitError as fw:
                update_dm_target(t['id'], 'pending', f'FloodWait {fw.seconds}s', acc['id'])
                peer_flood = True
                break
            except Exception as e:
                update_dm_target(t['id'], 'failed', str(e)[:200], acc['id'])
                failed += 1

            if i < len(targets) - 1:
                await asyncio.sleep(random.uniform(1.0, 2.5))
    finally:
        release_dm_targets([t['id'] for t in targets])
        try:
            await client.disconnect()
        except Exception:
            pass

    return {
        'ok': True, 'account': acc['label'], 'account_id': acc['id'],
        'sent': sent, 'privacy': privacy, 'failed': failed, 'peer_flood': peer_flood,
    }


# ---------- handler ----------

def get_status() -> dict:
    return {
        'ok': True,
        'counts': get_counts(),
        'accounts': get_accounts(),
        'message': get_message(),
        'click_total': DM_CLICK_TOTAL,
        'run_max': DM_RUN_MAX,
    }


def handler(event: dict, context) -> dict:
    """Рассылка в личные сообщения через user-аккаунты. Текст+фото общие, получатели из очереди инвайтов."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    headers = event.get('headers') or {}
    token = headers.get('x-admin-token') or headers.get('X-Admin-Token') or ''
    if not verify_token(token):
        return resp(401, {'error': 'unauthorized'})

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')

    if method == 'GET':
        return resp(200, get_status())

    body = {}
    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        body = {}

    if action == 'save_message':
        text = body.get('text', '') or ''
        photo_url = body.get('photo_url', '') or get_message()['photo_url']
        if body.get('photo_base64'):
            photo_url = upload_photo(body['photo_base64'], body.get('photo_ext', 'jpg'))
        if body.get('remove_photo'):
            photo_url = ''
        save_message(text, photo_url)
        return resp(200, {'ok': True, 'message': get_message()})

    if action == 'seed':
        res = seed_from_invites()
        return resp(200, {'ok': True, **res, 'counts': get_counts()})

    if action == 'clear':
        n = clear_queue()
        return resp(200, {'ok': True, 'deleted': n, 'counts': get_counts()})

    if action == 'clean_invalid':
        n = clean_invalid()
        return resp(200, {'ok': True, 'deleted': n, 'counts': get_counts()})

    if action == 'run_account':
        account_id = int(body.get('account_id', 0))
        size = int(body.get('size', DM_RUN_MAX))
        if account_id <= 0:
            return resp(400, {'ok': False, 'error': 'account_id обязателен'})
        result = asyncio.run(run_account_dm(account_id, size))
        return resp(200, result)

    return resp(400, {'ok': False, 'error': 'unknown action'})