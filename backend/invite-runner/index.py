"""Прямой инвайт юзеров в группу @UG_DRIVER через user-аккаунты Telethon.
GET                       — статус (текущий активный аккаунт + лимиты + последние результаты)
POST ?action=run_batch    — запустить пачку инвайтов (size: int, по умолчанию 5)
POST ?action=stop         — остановить активный запуск (если будет долгий цикл)
"""
import os
import json
import hashlib
import asyncio
import random
import time
import psycopg2

from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.tl.functions.channels import InviteToChannelRequest
from telethon.tl.functions.contacts import ResolveUsernameRequest
from telethon.errors import (
    FloodWaitError, UserPrivacyRestrictedError, UserNotMutualContactError,
    UserChannelsTooMuchError, UserKickedError, UserAlreadyParticipantError,
    UserBlockedError, UserBotError, UserIdInvalidError,
    PeerFloodError, ChatWriteForbiddenError, ChatAdminRequiredError,
    InputUserDeactivatedError, UsernameInvalidError, UsernameNotOccupiedError,
)

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
}
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')
TARGET_GROUP = '@UG_DRIVER'

DAILY_INVITE_LIMIT = 30          # макс инвайтов/сутки на аккаунт
PAUSE_MIN_SEC = 90               # мин пауза между инвайтами
PAUSE_MAX_SEC = 180              # макс пауза между инвайтами
MAX_BATCH_SIZE = 10              # макс инвайтов за один HTTP-запуск (чтобы влезть в таймаут функции)


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


def get_active_account() -> dict:
    """Активный, не забаненный, с дневным остатком > 0."""
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        SELECT id, label, phone, session_string,
               COALESCE(daily_invites_used, 0),
               daily_reset_date
        FROM {SCHEMA}.tg_user_accounts
        WHERE is_active=TRUE AND is_banned=FALSE
        LIMIT 1
    """)
    r = cur.fetchone(); cur.close(); conn.close()
    if not r:
        return {}
    used = int(r[4] or 0)
    reset_date = r[5]
    # Если дата последнего сброса < сегодня — счётчик считаем 0
    cur2 = db().cursor()
    cur2.execute("SELECT CURRENT_DATE")
    today = cur2.fetchone()[0]
    cur2.close()
    if reset_date is None or reset_date < today:
        used = 0
    return {
        'id': r[0], 'label': r[1], 'phone': r[2],
        'session_string': r[3], 'daily_invites_used': used,
        'daily_remaining': max(0, DAILY_INVITE_LIMIT - used),
    }


def pick_next_account_id() -> int | None:
    """Следующий не забаненный, минимум использований сегодня."""
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        SELECT id FROM {SCHEMA}.tg_user_accounts
        WHERE is_banned=FALSE
        ORDER BY
          CASE WHEN daily_reset_date < CURRENT_DATE THEN 0 ELSE COALESCE(daily_invites_used, 0) END ASC,
          last_used_at ASC NULLS FIRST,
          id ASC
        LIMIT 1
    """)
    r = cur.fetchone(); cur.close(); conn.close()
    return r[0] if r else None


def switch_active(account_id: int):
    conn = db(); cur = conn.cursor()
    cur.execute(f"UPDATE {SCHEMA}.tg_user_accounts SET is_active=FALSE")
    cur.execute(f"UPDATE {SCHEMA}.tg_user_accounts SET is_active=TRUE WHERE id={account_id}")
    conn.commit(); cur.close(); conn.close()


def mark_account_banned(account_id: int, note: str):
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        UPDATE {SCHEMA}.tg_user_accounts
        SET is_banned=TRUE, is_active=FALSE, notes='{esc(note[:200])}'
        WHERE id={account_id}
    """)
    conn.commit(); cur.close(); conn.close()


def increment_account_usage(account_id: int):
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        UPDATE {SCHEMA}.tg_user_accounts
        SET daily_invites_used = CASE
                WHEN daily_reset_date < CURRENT_DATE OR daily_reset_date IS NULL THEN 1
                ELSE COALESCE(daily_invites_used, 0) + 1
            END,
            daily_reset_date = CURRENT_DATE,
            last_used_at = NOW()
        WHERE id={account_id}
    """)
    conn.commit(); cur.close(); conn.close()


def get_pending_targets(limit: int) -> list:
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        SELECT id, username, phone, first_name
        FROM {SCHEMA}.invite_targets
        WHERE status='pending' AND username IS NOT NULL AND username <> ''
        ORDER BY id ASC
        LIMIT {int(limit)}
    """)
    rows = cur.fetchall(); cur.close(); conn.close()
    return [{'id': r[0], 'username': r[1], 'phone': r[2], 'first_name': r[3]} for r in rows]


def update_target(target_id: int, status: str, error: str = '', account_id: int = 0):
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        UPDATE {SCHEMA}.invite_targets
        SET status='{esc(status)}',
            error='{esc(error[:300])}',
            added_at = CASE WHEN '{esc(status)}'='added' THEN NOW() ELSE added_at END,
            invited_by_account_id = {int(account_id) or 'NULL'}
        WHERE id={int(target_id)}
    """)
    conn.commit(); cur.close(); conn.close()


def log_run(account_id: int, attempted: int, added: int, privacy: int, failed: int, ban_triggered: bool, note: str):
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        INSERT INTO {SCHEMA}.invite_run_log (account_id, attempted, added, privacy, failed, ban_triggered, note, created_at)
        VALUES ({int(account_id)}, {attempted}, {added}, {privacy}, {failed}, {str(bool(ban_triggered)).upper()}, '{esc(note[:500])}', NOW())
    """)
    conn.commit(); cur.close(); conn.close()


def recent_logs(limit: int = 20) -> list:
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        SELECT l.id, l.account_id, a.label, l.attempted, l.added, l.privacy, l.failed,
               l.ban_triggered, l.note, l.created_at
        FROM {SCHEMA}.invite_run_log l
        LEFT JOIN {SCHEMA}.tg_user_accounts a ON a.id = l.account_id
        ORDER BY l.id DESC LIMIT {int(limit)}
    """)
    rows = cur.fetchall(); cur.close(); conn.close()
    return [{
        'id': r[0], 'account_id': r[1], 'account_label': r[2],
        'attempted': r[3], 'added': r[4], 'privacy': r[5], 'failed': r[6],
        'ban_triggered': r[7], 'note': r[8] or '', 'created_at': str(r[9]),
    } for r in rows]


# ---------- Telethon ----------

async def run_batch(size: int) -> dict:
    api_id = int(os.environ['TG_API_ID'])
    api_hash = os.environ['TG_API_HASH']

    acc = get_active_account()
    if not acc:
        return {'ok': False, 'error': 'Нет активного аккаунта в пуле. Подключи или активируй.'}

    remaining = acc['daily_remaining']
    if remaining <= 0:
        # автоматически переключаемся на следующий
        nxt = pick_next_account_id()
        if nxt and nxt != acc['id']:
            switch_active(nxt)
            return {'ok': False, 'error': f'У «{acc["label"]}» закончился дневной лимит. Активирован другой аккаунт — нажми «Запустить» ещё раз.', 'switched': True}
        return {'ok': False, 'error': f'У всех аккаунтов исчерпан дневной лимит {DAILY_INVITE_LIMIT}/сутки. Жди до завтра или добавь ещё аккаунты.'}

    take = min(size, remaining, MAX_BATCH_SIZE)
    targets = get_pending_targets(take)
    if not targets:
        return {'ok': True, 'message': 'В очереди нет кандидатов со статусом pending.', 'attempted': 0}

    client = TelegramClient(StringSession(acc['session_string']), api_id, api_hash)
    await client.connect()

    if not await client.is_user_authorized():
        await client.disconnect()
        mark_account_banned(acc['id'], 'Сессия невалидна (не авторизован)')
        nxt = pick_next_account_id()
        if nxt:
            switch_active(nxt)
        return {'ok': False, 'error': f'Сессия аккаунта «{acc["label"]}» сдохла. Помечен как забаненный, переключились на следующий.'}

    added = 0; privacy = 0; failed = 0; attempted = 0
    ban_triggered = False
    ban_note = ''
    results = []

    try:
        # резолвим целевую группу
        try:
            target_entity = await client.get_entity(TARGET_GROUP)
        except Exception as e:
            await client.disconnect()
            return {'ok': False, 'error': f'Не могу найти {TARGET_GROUP}: {e}. Аккаунт должен быть участником этой группы.'}

        for i, t in enumerate(targets):
            attempted += 1
            uname = t['username']
            try:
                user_entity = await client.get_entity(uname)
            except (UsernameInvalidError, UsernameNotOccupiedError, ValueError):
                update_target(t['id'], 'failed', 'username не существует', acc['id'])
                failed += 1
                results.append({'username': uname, 'status': 'failed', 'reason': 'username не существует'})
                continue
            except FloodWaitError as fw:
                ban_note = f'FloodWait при resolve {uname}: {fw.seconds}s'
                if fw.seconds > 600:
                    ban_triggered = True
                break
            except Exception as e:
                update_target(t['id'], 'failed', f'resolve: {e}', acc['id'])
                failed += 1
                results.append({'username': uname, 'status': 'failed', 'reason': str(e)[:120]})
                continue

            try:
                await client(InviteToChannelRequest(channel=target_entity, users=[user_entity]))
                update_target(t['id'], 'added', '', acc['id'])
                increment_account_usage(acc['id'])
                added += 1
                results.append({'username': uname, 'status': 'added'})
            except UserPrivacyRestrictedError:
                update_target(t['id'], 'privacy', 'USER_PRIVACY_RESTRICTED', acc['id'])
                privacy += 1
                results.append({'username': uname, 'status': 'privacy'})
            except UserAlreadyParticipantError:
                update_target(t['id'], 'added', 'already in group', acc['id'])
                added += 1
                results.append({'username': uname, 'status': 'already_in'})
            except (UserNotMutualContactError, UserKickedError, UserBlockedError,
                    UserBotError, UserIdInvalidError, InputUserDeactivatedError) as e:
                update_target(t['id'], 'failed', type(e).__name__, acc['id'])
                failed += 1
                results.append({'username': uname, 'status': 'failed', 'reason': type(e).__name__})
            except UserChannelsTooMuchError:
                update_target(t['id'], 'failed', 'у юзера слишком много каналов', acc['id'])
                failed += 1
                results.append({'username': uname, 'status': 'failed', 'reason': 'too_many_channels'})
            except (PeerFloodError,) as e:
                ban_triggered = True
                ban_note = f'PeerFloodError на {uname}'
                results.append({'username': uname, 'status': 'flood', 'reason': 'PEER_FLOOD'})
                break
            except FloodWaitError as fw:
                ban_note = f'FloodWait {fw.seconds}s на {uname}'
                if fw.seconds > 3600:  # час и больше — считаем баном
                    ban_triggered = True
                results.append({'username': uname, 'status': 'flood_wait', 'reason': f'{fw.seconds}s'})
                break
            except (ChatWriteForbiddenError, ChatAdminRequiredError) as e:
                # это уже наша проблема (нет прав в чате) — стопаем весь батч
                ban_note = f'Нет прав в {TARGET_GROUP}: {type(e).__name__}'
                await client.disconnect()
                log_run(acc['id'], attempted, added, privacy, failed, False, ban_note)
                return {'ok': False, 'error': ban_note, 'results': results}
            except Exception as e:
                update_target(t['id'], 'failed', str(e)[:200], acc['id'])
                failed += 1
                results.append({'username': uname, 'status': 'failed', 'reason': str(e)[:120]})

            # пауза между инвайтами (кроме последнего)
            if i < len(targets) - 1 and not ban_triggered:
                pause = random.randint(PAUSE_MIN_SEC, PAUSE_MAX_SEC)
                await asyncio.sleep(pause)

    finally:
        await client.disconnect()

    log_run(acc['id'], attempted, added, privacy, failed, ban_triggered, ban_note)

    switched_to = None
    if ban_triggered:
        mark_account_banned(acc['id'], ban_note)
        nxt = pick_next_account_id()
        if nxt:
            switch_active(nxt)
            switched_to = nxt

    return {
        'ok': True,
        'account': {'id': acc['id'], 'label': acc['label']},
        'attempted': attempted, 'added': added, 'privacy': privacy, 'failed': failed,
        'ban_triggered': ban_triggered, 'ban_note': ban_note,
        'switched_to_account_id': switched_to,
        'results': results,
    }


def get_status() -> dict:
    acc = get_active_account()
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        SELECT
            COUNT(*) FILTER (WHERE status='pending') AS pending,
            COUNT(*) FILTER (WHERE status='added') AS added,
            COUNT(*) FILTER (WHERE status='privacy') AS privacy,
            COUNT(*) FILTER (WHERE status='failed') AS failed
        FROM {SCHEMA}.invite_targets
    """)
    row = cur.fetchone()
    cur.close(); conn.close()
    return {
        'target_group': TARGET_GROUP,
        'daily_limit': DAILY_INVITE_LIMIT,
        'pause_range_sec': [PAUSE_MIN_SEC, PAUSE_MAX_SEC],
        'max_batch': MAX_BATCH_SIZE,
        'active_account': acc or None,
        'queue': {'pending': row[0], 'added': row[1], 'privacy': row[2], 'failed': row[3]},
        'recent_runs': recent_logs(20),
    }


def handler(event: dict, context) -> dict:
    """Прямой инвайт пачки кандидатов в @UG_DRIVER через активный user-аккаунт."""
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
        return resp(200, get_status())

    body = json.loads(event.get('body') or '{}')

    if action == 'run_batch':
        size = int(body.get('size', 5))
        if size < 1: size = 1
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(run_batch(size))
            return resp(200, result)
        finally:
            loop.close()

    return resp(400, {'error': 'unknown action'})
