"""Запуск рассылки приглашений в группу.
GET                    — статус текущего запуска
POST ?action=start     — начать рассылку (план на сегодня)
POST ?action=tick      — пригласить одного человека (size=N — пачкой)
POST ?action=stop      — остановить рассылку
POST ?action=set_pace  — сменить темп: safe / normal / fast / max
"""
import os
import json
import asyncio
import hashlib
import psycopg2

from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.tl.functions.channels import InviteToChannelRequest
from telethon.errors import (
    UserPrivacyRestrictedError, UserNotMutualContactError, PeerFloodError,
    FloodWaitError, UserChannelsTooMuchError, UserAlreadyParticipantError,
    InputUserDeactivatedError, UserBannedInChannelError, ChatWriteForbiddenError,
)

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')

PACES = {
    'safe':   {'warmup': 10, 'normal': 30,  'delay': 60, 'title': 'Осторожно'},
    'normal': {'warmup': 15, 'normal': 50,  'delay': 40, 'title': 'Обычно'},
    'fast':   {'warmup': 20, 'normal': 80,  'delay': 25, 'title': 'Быстро'},
    'max':    {'warmup': 25, 'normal': 120, 'delay': 15, 'title': 'Максимум'},
}
DEFAULT_PACE = 'safe'


def db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def esc(s) -> str:
    return str(s).replace("'", "''")


def resp(status: int, body: dict) -> dict:
    return {
        'statusCode': status,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        'isBase64Encoded': False,
        'body': json.dumps(body, ensure_ascii=False, default=str),
    }


def verify_token(token: str) -> bool:
    if not token:
        return False
    admin_tok = hashlib.sha256(
        f"{os.environ.get('ADMIN_LOGIN', '')}:{os.environ.get('ADMIN_PASSWORD', '')}:admin_secret_2026".encode()
    ).hexdigest()
    posts_login = os.environ.get('POSTS_LOGIN', '')
    posts_tok = hashlib.sha256(
        f"{posts_login}:{os.environ.get('POSTS_PASSWORD', '')}:posts_secret_2026".encode()
    ).hexdigest()
    return token == admin_tok or (bool(posts_login) and token == posts_tok)


def get_invite_target() -> str:
    conn = db(); cur = conn.cursor()
    cur.execute(f"SELECT value FROM {SCHEMA}.app_settings WHERE key='invite_target_group'")
    r = cur.fetchone(); cur.close(); conn.close()
    return (r[0] if r else 'https://t.me/moy_transfer').strip()


def parse_username(s: str) -> str:
    import re
    s = (s or '').strip().lstrip('@')
    m = re.search(r'(?:t\.me/|telegram\.me/)([A-Za-z][A-Za-z0-9_]{3,31})$', s)
    if m:
        return m.group(1)
    if re.fullmatch(r'[A-Za-z][A-Za-z0-9_]{3,31}', s):
        return s
    return ''


def reset_daily_if_needed():
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        UPDATE {SCHEMA}.tg_user_accounts
        SET daily_invites_used = 0, daily_reset_date = CURRENT_DATE
        WHERE daily_reset_date < CURRENT_DATE
    """)
    conn.commit(); cur.close(); conn.close()


def get_pace() -> dict:
    conn = db(); cur = conn.cursor()
    cur.execute(f"SELECT value FROM {SCHEMA}.app_settings WHERE key='invite_pace'")
    r = cur.fetchone(); cur.close(); conn.close()
    key = (r[0] if r else DEFAULT_PACE).strip()
    if key not in PACES:
        key = DEFAULT_PACE
    return {'key': key, **PACES[key]}


def set_pace(key: str) -> dict:
    if key not in PACES:
        key = DEFAULT_PACE
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        INSERT INTO {SCHEMA}.app_settings (key, value, updated_at)
        VALUES ('invite_pace', '{esc(key)}', NOW())
        ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()
    """)
    conn.commit(); cur.close(); conn.close()
    return {'key': key, **PACES[key]}


def account_pool() -> list:
    pace = get_pace()
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        SELECT id, label, session_string, daily_invites_used, COALESCE(needs_warmup, TRUE)
        FROM {SCHEMA}.tg_user_accounts
        WHERE is_banned = FALSE
        ORDER BY daily_invites_used ASC, id ASC
    """)
    rows = cur.fetchall(); cur.close(); conn.close()
    out = []
    for r in rows:
        limit = pace['warmup'] if r[4] else pace['normal']
        out.append({
            'id': r[0], 'label': r[1], 'session': r[2],
            'used': r[3], 'warmup': r[4], 'limit': limit,
            'left': max(0, limit - r[3]),
        })
    return out


def active_base_id() -> int:
    conn = db(); cur = conn.cursor()
    cur.execute(f"SELECT value FROM {SCHEMA}.app_settings WHERE key='invite_active_base'")
    r = cur.fetchone(); cur.close(); conn.close()
    return int(r[0]) if r and str(r[0]).isdigit() else 0


def pending_count(base_id: int) -> int:
    conn = db(); cur = conn.cursor()
    where = f"AND base_id = {int(base_id)}" if base_id else ""
    cur.execute(f"""
        SELECT COUNT(*) FROM {SCHEMA}.invite_targets
        WHERE status='pending' AND username IS NOT NULL AND username <> '' {where}
    """)
    n = cur.fetchone()[0]; cur.close(); conn.close()
    return n


def skip_no_username(base_id: int) -> int:
    """Разом помечает контакты без ника — их пригласить нельзя."""
    conn = db(); cur = conn.cursor()
    where = f"AND base_id = {int(base_id)}" if base_id else ""
    cur.execute(f"""
        UPDATE {SCHEMA}.invite_targets
        SET status = 'no_username', error = 'Нет ника'
        WHERE status = 'pending' AND (username IS NULL OR username = '') {where}
    """)
    n = cur.rowcount
    conn.commit(); cur.close(); conn.close()
    return n


def run_state() -> dict:
    reset_daily_if_needed()
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        SELECT is_active, title, subtitle, total_planned, progress_done,
               progress_added, progress_privacy, progress_failed, last_message, started_at
        FROM {SCHEMA}.invite_active_run WHERE id = 1
    """)
    r = cur.fetchone(); cur.close(); conn.close()
    pool = account_pool()
    base = active_base_id()
    capacity = sum(a['left'] for a in pool)
    state = {
        'is_active': bool(r[0]) if r else False,
        'title': r[1] if r else '',
        'subtitle': r[2] if r else '',
        'total_planned': r[3] if r else 0,
        'done': r[4] if r else 0,
        'added': r[5] if r else 0,
        'privacy': r[6] if r else 0,
        'failed': r[7] if r else 0,
        'last_message': r[8] if r else '',
        'started_at': str(r[9]) if r and r[9] else None,
    }
    pace = get_pace()
    state['pending'] = pending_count(base)
    state['capacity_today'] = capacity
    state['pace'] = pace['key']
    state['delay_sec'] = pace['delay']
    state['pace_options'] = [
        {
            'key': k,
            'title': v['title'],
            'per_day': sum(v['warmup'] if a['warmup'] else v['normal'] for a in pool),
            'delay': v['delay'],
        }
        for k, v in PACES.items()
    ]
    state['accounts'] = [
        {'id': a['id'], 'label': a['label'], 'used': a['used'],
         'limit': a['limit'], 'left': a['left'], 'warmup': a['warmup']}
        for a in pool
    ]
    return state


def save_run(**kw):
    sets = ', '.join(f"{k} = {v if isinstance(v, (int, float)) and not isinstance(v, bool) else ('TRUE' if v is True else 'FALSE' if v is False else chr(39) + esc(v) + chr(39))}" for k, v in kw.items())
    conn = db(); cur = conn.cursor()
    cur.execute(f"UPDATE {SCHEMA}.invite_active_run SET {sets}, last_heartbeat = NOW() WHERE id = 1")
    conn.commit(); cur.close(); conn.close()


def start_run() -> dict:
    pool = account_pool()
    base = active_base_id()
    skip_no_username(base)
    pending = pending_count(base)
    capacity = sum(a['left'] for a in pool)
    planned = min(pending, capacity)
    if planned <= 0:
        reason = 'В активной базе нет контактов в очереди' if pending == 0 else 'Все аккаунты исчерпали дневной лимит'
        return {'ok': False, 'error': reason}
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        UPDATE {SCHEMA}.invite_active_run
        SET is_active = TRUE, mode = 'pool', title = 'Рассылка приглашений',
            subtitle = '{esc(str(len(pool)))} аккаунтов в работе',
            total_planned = {planned}, progress_done = 0, progress_added = 0,
            progress_privacy = 0, progress_failed = 0, started_at = NOW(),
            estimated_sec = {planned * get_pace()['delay']}, last_message = 'Запускаем…', last_heartbeat = NOW()
        WHERE id = 1
    """)
    conn.commit(); cur.close(); conn.close()
    return {'ok': True, 'state': run_state()}


def stop_run(msg: str = 'Остановлено вручную') -> dict:
    save_run(is_active=False, last_message=msg)
    return {'ok': True, 'state': run_state()}


def take_target(base_id: int) -> dict:
    conn = db(); cur = conn.cursor()
    where = f"AND base_id = {int(base_id)}" if base_id else ""
    cur.execute(f"""
        SELECT id, username, user_id FROM {SCHEMA}.invite_targets
        WHERE status = 'pending' AND username IS NOT NULL AND username <> '' {where}
        ORDER BY id ASC LIMIT 1
    """)
    r = cur.fetchone(); cur.close(); conn.close()
    if not r:
        return {}
    return {'id': r[0], 'username': r[1], 'user_id': r[2]}


def mark_target(tid: int, status: str, account_id: int = 0, error: str = ''):
    conn = db(); cur = conn.cursor()
    acc = f"{int(account_id)}" if account_id else "NULL"
    added = "NOW()" if status == 'added' else "NULL"
    cur.execute(f"""
        UPDATE {SCHEMA}.invite_targets
        SET status = '{esc(status)}', invited_by_account_id = {acc},
            added_at = {added}, error = '{esc(error[:300])}'
        WHERE id = {int(tid)}
    """)
    conn.commit(); cur.close(); conn.close()


def bump_account(account_id: int):
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        UPDATE {SCHEMA}.tg_user_accounts
        SET daily_invites_used = daily_invites_used + 1, last_used_at = NOW()
        WHERE id = {int(account_id)}
    """)
    conn.commit(); cur.close(); conn.close()


def ban_account(account_id: int, note: str):
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        UPDATE {SCHEMA}.tg_user_accounts
        SET daily_invites_used = 999, notes = '{esc(note[:200])}'
        WHERE id = {int(account_id)}
    """)
    conn.commit(); cur.close(); conn.close()


def log_run(account_id: int, added: int, privacy: int, failed: int, note: str, ban: bool = False):
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        INSERT INTO {SCHEMA}.invite_run_log (account_id, attempted, added, privacy, failed, ban_triggered, note)
        VALUES ({int(account_id)}, 1, {added}, {privacy}, {failed}, {'TRUE' if ban else 'FALSE'}, '{esc(note[:300])}')
    """)
    conn.commit(); cur.close(); conn.close()


def progress(field: str, msg: str):
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        UPDATE {SCHEMA}.invite_active_run
        SET progress_done = progress_done + 1, {field} = {field} + 1,
            last_message = '{esc(msg[:300])}', last_heartbeat = NOW()
        WHERE id = 1
    """)
    cur.execute(f"""
        UPDATE {SCHEMA}.invite_active_run SET is_active = FALSE
        WHERE id = 1 AND progress_done >= total_planned
    """)
    conn.commit(); cur.close(); conn.close()


async def invite_one() -> dict:
    """Один шаг рассылки: берём контакт, берём свободный аккаунт, приглашаем."""
    reset_daily_if_needed()
    base = active_base_id()
    target_link = get_invite_target()
    username_group = parse_username(target_link)
    if not username_group:
        stop_run('Не понял ссылку на группу — нужна вида https://t.me/имя')
        return {'ok': False, 'error': 'Некорректная ссылка на группу'}

    tgt = take_target(base)
    if not tgt:
        stop_run('Готово: контакты в очереди закончились')
        return {'ok': True, 'finished': True, 'state': run_state()}

    pool = [a for a in account_pool() if a['left'] > 0]
    if not pool:
        stop_run('На сегодня лимиты аккаунтов исчерпаны, продолжим завтра')
        return {'ok': True, 'finished': True, 'state': run_state()}

    acc = pool[0]
    if not tgt.get('username'):
        mark_target(tgt['id'], 'no_username', 0, 'Нет ника')
        progress('progress_failed', 'Пропущен контакт без ника')
        return {'ok': True, 'result': 'no_username', 'state': run_state()}

    api_id = int(os.environ['TG_API_ID'])
    api_hash = os.environ['TG_API_HASH']
    client = TelegramClient(StringSession(acc['session']), api_id, api_hash)
    await client.connect()
    try:
        if not await client.is_user_authorized():
            ban_account(acc['id'], 'Сессия невалидна')
            return {'ok': False, 'error': f"{acc['label']}: сессия невалидна", 'state': run_state()}
        group = await client.get_entity(username_group)
        user = await client.get_entity(tgt['username'])
        await client(InviteToChannelRequest(group, [user]))
        mark_target(tgt['id'], 'added', acc['id'])
        bump_account(acc['id'])
        log_run(acc['id'], 1, 0, 0, f"@{tgt['username']} приглашён")
        progress('progress_added', f"@{tgt['username']} приглашён · {acc['label']}")
        return {'ok': True, 'result': 'added', 'username': tgt['username'],
                'account': acc['label'], 'state': run_state()}
    except (UserPrivacyRestrictedError, UserNotMutualContactError) as e:
        mark_target(tgt['id'], 'failed', acc['id'], 'Закрытые настройки приватности')
        bump_account(acc['id'])
        log_run(acc['id'], 0, 1, 0, 'privacy')
        progress('progress_privacy', f"@{tgt['username']}: закрыт приватностью")
        return {'ok': True, 'result': 'privacy', 'state': run_state()}
    except UserAlreadyParticipantError:
        mark_target(tgt['id'], 'added', acc['id'], 'Уже в группе')
        progress('progress_added', f"@{tgt['username']} уже в группе")
        return {'ok': True, 'result': 'already', 'state': run_state()}
    except PeerFloodError:
        ban_account(acc['id'], 'PEER_FLOOD: лимит приглашений')
        log_run(acc['id'], 0, 0, 1, 'PEER_FLOOD', True)
        return {'ok': True, 'result': 'peer_flood',
                'error': f"{acc['label']}: упёрся в лимит Telegram, переключаемся",
                'state': run_state()}
    except FloodWaitError as fw:
        ban_account(acc['id'], f'FloodWait {fw.seconds} сек')
        log_run(acc['id'], 0, 0, 1, f'FloodWait {fw.seconds}', True)
        return {'ok': True, 'result': 'flood_wait',
                'error': f"{acc['label']}: пауза {fw.seconds} сек от Telegram",
                'state': run_state()}
    except (InputUserDeactivatedError, UserChannelsTooMuchError,
            UserBannedInChannelError, ChatWriteForbiddenError) as e:
        mark_target(tgt['id'], 'failed', acc['id'], type(e).__name__)
        log_run(acc['id'], 0, 0, 1, type(e).__name__)
        progress('progress_failed', f"@{tgt['username']}: {type(e).__name__}")
        return {'ok': True, 'result': 'failed', 'state': run_state()}
    except Exception as e:
        mark_target(tgt['id'], 'failed', acc['id'], str(e)[:200])
        log_run(acc['id'], 0, 0, 1, str(e)[:200])
        progress('progress_failed', f"@{tgt['username']}: {str(e)[:120]}")
        return {'ok': True, 'result': 'failed', 'state': run_state()}
    finally:
        await client.disconnect()


async def invite_batch(size: int) -> dict:
    """Несколько приглашений подряд за один вызов — экономит время на подключении."""
    import time
    started = time.time()
    results = []
    last = {}
    for i in range(max(1, min(size, 10))):
        last = await invite_one()
        results.append(last.get('result') or last.get('error'))
        if last.get('finished') or not last.get('ok'):
            break
        if last.get('result') in ('peer_flood', 'flood_wait'):
            break
        if time.time() - started > 25:
            break
        if i < size - 1:
            await asyncio.sleep(2)
    out = dict(last)
    out['batch'] = results
    return out


def handler(event: dict, context) -> dict:
    """Управляет рассылкой приглашений: старт, шаг, стоп, статус."""
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
            'Access-Control-Max-Age': '86400',
        }, 'body': ''}

    headers = {k.lower(): v for k, v in (event.get('headers') or {}).items()}
    if not verify_token(headers.get('x-admin-token', '')):
        return resp(401, {'ok': False, 'error': 'Нет доступа'})

    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')

    if method == 'GET':
        return resp(200, {'ok': True, 'state': run_state()})

    if action == 'start':
        return resp(200, start_run())

    if action == 'stop':
        return resp(200, stop_run())

    if action == 'set_pace':
        body = json.loads(event.get('body') or '{}')
        set_pace((body.get('pace') or '').strip())
        return resp(200, {'ok': True, 'state': run_state()})

    if action == 'tick':
        size = int(params.get('size') or 1)
        result = asyncio.run(invite_batch(size) if size > 1 else invite_one())
        return resp(200, result)

    return resp(400, {'ok': False, 'error': 'Неизвестное действие'})