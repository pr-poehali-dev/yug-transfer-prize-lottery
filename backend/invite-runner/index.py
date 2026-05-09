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


def get_target_group() -> str:
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL']); cur = conn.cursor()
        cur.execute(f"SELECT value FROM {SCHEMA}.app_settings WHERE key='target_group'")
        r = cur.fetchone(); cur.close(); conn.close()
        return (r[0] if r else '@UG_DRIVER').strip()
    except Exception:
        return '@UG_DRIVER'


DAILY_INVITE_LIMIT = 30          # макс инвайтов/сутки на аккаунт (после прогрева)
PAUSE_MIN_SEC = 90               # мин пауза между инвайтами в одной пачке
PAUSE_MAX_SEC = 180              # макс пауза между инвайтами в одной пачке
MAX_BATCH_SIZE = 10              # макс инвайтов за один HTTP-запуск

# Расписание прогрева: день (1-based) -> (сколько аккаунтов работают, инвайтов с каждого)
# День 1: 1 аккаунт × 1 инвайт. День 2: 2×2. День 3: 3×3. День 4+: 4×4 ... до DAILY_INVITE_LIMIT
WARMUP_SCHEDULE = {
    1: (1, 1),
    2: (2, 2),
    3: (3, 3),
    4: (4, 4),
}


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


def get_setting(key: str, default: str = '') -> str:
    try:
        conn = db(); cur = conn.cursor()
        cur.execute(f"SELECT value FROM {SCHEMA}.app_settings WHERE key='{esc(key)}'")
        r = cur.fetchone(); cur.close(); conn.close()
        return (r[0] if r else default).strip()
    except Exception:
        return default


def set_setting(key: str, value: str):
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        INSERT INTO {SCHEMA}.app_settings (key, value, updated_at)
        VALUES ('{esc(key)}', '{esc(value)}', NOW())
        ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()
    """)
    conn.commit(); cur.close(); conn.close()


def get_warmup_state() -> dict:
    """Возвращает: enabled, start_date, day_num, accounts_today, per_account_today."""
    enabled = get_setting('warmup_enabled', 'false') == 'true'
    start_str = get_setting('warmup_start_date', '')

    conn = db(); cur = conn.cursor()
    cur.execute("SELECT CURRENT_DATE")
    today = cur.fetchone()[0]
    cur.close(); conn.close()

    if not start_str:
        return {'enabled': enabled, 'start_date': None, 'day_num': 0,
                'accounts_today': 0, 'per_account_today': 0, 'today': str(today)}

    from datetime import date
    try:
        y, m, d = start_str.split('-')
        start_d = date(int(y), int(m), int(d))
    except Exception:
        return {'enabled': enabled, 'start_date': start_str, 'day_num': 0,
                'accounts_today': 0, 'per_account_today': 0, 'today': str(today)}

    delta = (today - start_d).days + 1  # день 1 = старт
    if delta < 1:
        delta = 1

    if delta in WARMUP_SCHEDULE:
        accs, per = WARMUP_SCHEDULE[delta]
    else:
        # после 4-го дня — каждый день по 4 аккаунта × N (растёт на 1 в день до DAILY_INVITE_LIMIT)
        per = min(4 + (delta - 4), DAILY_INVITE_LIMIT)
        accs = 4

    return {
        'enabled': enabled, 'start_date': start_str, 'day_num': delta,
        'accounts_today': accs, 'per_account_today': per, 'today': str(today),
    }


def get_warmup_accounts(limit: int) -> list:
    """Берёт только аккаунты которым НУЖЕН прогрев (needs_warmup=TRUE).
    Не забаненные, сегодня в прогреве не работавшие."""
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        SELECT id, label, phone, session_string,
               COALESCE(daily_invites_used, 0), daily_reset_date,
               warmup_last_invite_date
        FROM {SCHEMA}.tg_user_accounts
        WHERE is_banned=FALSE
          AND needs_warmup=TRUE
          AND (warmup_last_invite_date IS NULL OR warmup_last_invite_date < CURRENT_DATE)
        ORDER BY is_active DESC, id ASC
        LIMIT {int(limit)}
    """)
    rows = cur.fetchall(); cur.close(); conn.close()
    return [{
        'id': r[0], 'label': r[1], 'phone': r[2], 'session_string': r[3],
        'daily_invites_used': int(r[4] or 0), 'daily_reset_date': r[5],
        'warmup_last_invite_date': r[6],
    } for r in rows]


def mark_warmup_done(account_id: int):
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        UPDATE {SCHEMA}.tg_user_accounts
        SET warmup_last_invite_date = CURRENT_DATE
        WHERE id = {int(account_id)}
    """)
    conn.commit(); cur.close(); conn.close()


def get_full_power_accounts() -> list:
    """Берёт все прогретые аккаунты (needs_warmup=FALSE) у которых остался дневной лимит."""
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        SELECT id, label, phone, session_string,
               COALESCE(daily_invites_used, 0), daily_reset_date
        FROM {SCHEMA}.tg_user_accounts
        WHERE is_banned=FALSE AND needs_warmup=FALSE
        ORDER BY is_active DESC, id ASC
    """)
    rows = cur.fetchall(); cur.close(); conn.close()
    today = None
    conn = db(); cur = conn.cursor()
    cur.execute("SELECT CURRENT_DATE")
    today = cur.fetchone()[0]
    cur.close(); conn.close()
    accounts = []
    for r in rows:
        used = int(r[4] or 0)
        reset_date = r[5]
        if reset_date is None or reset_date < today:
            used = 0
        remaining = max(0, DAILY_INVITE_LIMIT - used)
        if remaining > 0:
            accounts.append({
                'id': r[0], 'label': r[1], 'phone': r[2], 'session_string': r[3],
                'daily_invites_used': used, 'daily_remaining': remaining,
            })
    return accounts


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

    target_group = get_target_group()
    try:
        # резолвим целевую группу
        try:
            target_entity = await client.get_entity(target_group)
        except Exception as e:
            await client.disconnect()
            return {'ok': False, 'error': f'Не могу найти {target_group}: {e}. Аккаунт должен быть участником этой группы.'}

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
                ban_note = f'Нет прав в {target_group}: {type(e).__name__}'
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


async def invite_one_user(client, target_entity, target: dict, account_id: int) -> dict:
    """Один инвайт. Возвращает {status, reason}. Меняет БД (статус кандидата + счётчик)."""
    uname = target['username']
    try:
        user_entity = await client.get_entity(uname)
    except (UsernameInvalidError, UsernameNotOccupiedError, ValueError):
        update_target(target['id'], 'failed', 'username не существует', account_id)
        return {'username': uname, 'status': 'failed', 'reason': 'не существует'}
    except FloodWaitError as fw:
        return {'username': uname, 'status': 'flood_wait', 'reason': f'{fw.seconds}s', 'fw_seconds': fw.seconds}
    except Exception as e:
        update_target(target['id'], 'failed', f'resolve: {e}', account_id)
        return {'username': uname, 'status': 'failed', 'reason': str(e)[:120]}

    try:
        await client(InviteToChannelRequest(channel=target_entity, users=[user_entity]))
        update_target(target['id'], 'added', '', account_id)
        increment_account_usage(account_id)
        return {'username': uname, 'status': 'added'}
    except UserPrivacyRestrictedError:
        update_target(target['id'], 'privacy', 'USER_PRIVACY_RESTRICTED', account_id)
        return {'username': uname, 'status': 'privacy'}
    except UserAlreadyParticipantError:
        update_target(target['id'], 'added', 'already in group', account_id)
        return {'username': uname, 'status': 'already_in'}
    except (UserNotMutualContactError, UserKickedError, UserBlockedError,
            UserBotError, UserIdInvalidError, InputUserDeactivatedError) as e:
        update_target(target['id'], 'failed', type(e).__name__, account_id)
        return {'username': uname, 'status': 'failed', 'reason': type(e).__name__}
    except UserChannelsTooMuchError:
        update_target(target['id'], 'failed', 'у юзера слишком много каналов', account_id)
        return {'username': uname, 'status': 'failed', 'reason': 'too_many_channels'}
    except PeerFloodError:
        return {'username': uname, 'status': 'peer_flood', 'reason': 'PEER_FLOOD'}
    except FloodWaitError as fw:
        return {'username': uname, 'status': 'flood_wait', 'reason': f'{fw.seconds}s', 'fw_seconds': fw.seconds}
    except (ChatWriteForbiddenError, ChatAdminRequiredError) as e:
        return {'username': uname, 'status': 'no_rights', 'reason': type(e).__name__}
    except Exception as e:
        update_target(target['id'], 'failed', str(e)[:200], account_id)
        return {'username': uname, 'status': 'failed', 'reason': str(e)[:120]}


async def run_warmup_for_account(acc: dict, per_account: int) -> dict:
    """Делает per_account инвайтов с одного аккаунта. Между инвайтами пауза 90-180 сек."""
    api_id = int(os.environ['TG_API_ID'])
    api_hash = os.environ['TG_API_HASH']
    target_group = get_target_group()

    targets = get_pending_targets(per_account)
    if not targets:
        return {'ok': False, 'account': acc['label'], 'error': 'Нет pending кандидатов'}

    client = TelegramClient(StringSession(acc['session_string']), api_id, api_hash)
    await client.connect()
    added = 0; privacy = 0; failed = 0; ban = False; ban_note = ''
    results = []

    try:
        if not await client.is_user_authorized():
            mark_account_banned(acc['id'], 'Сессия невалидна')
            return {'ok': False, 'account': acc['label'], 'error': 'Сессия мертва, помечен бан'}
        try:
            target_entity = await client.get_entity(target_group)
        except Exception as e:
            return {'ok': False, 'account': acc['label'], 'error': f'Группа {target_group}: {e}'}

        for i, t in enumerate(targets):
            r = await invite_one_user(client, target_entity, t, acc['id'])
            results.append(r)
            if r['status'] == 'added' or r['status'] == 'already_in': added += 1
            elif r['status'] == 'privacy': privacy += 1
            elif r['status'] in ('peer_flood',):
                ban = True; ban_note = f'PEER_FLOOD на {r["username"]}'; break
            elif r['status'] == 'flood_wait' and r.get('fw_seconds', 0) > 3600:
                ban = True; ban_note = f'FloodWait {r.get("fw_seconds")}s'; break
            elif r['status'] == 'no_rights':
                ban_note = f'Нет прав: {r["reason"]}'; break
            else: failed += 1

            if i < len(targets) - 1 and not ban:
                await asyncio.sleep(random.randint(PAUSE_MIN_SEC, PAUSE_MAX_SEC))
    finally:
        await client.disconnect()

    log_run(acc['id'], len(results), added, privacy, failed, ban, ban_note)
    if ban:
        mark_account_banned(acc['id'], ban_note)
    else:
        # Помечаем что аккаунт сегодня уже отработал в режиме прогрева
        mark_warmup_done(acc['id'])

    return {
        'ok': True, 'account': acc['label'], 'account_id': acc['id'],
        'added': added, 'privacy': privacy, 'failed': failed,
        'ban_triggered': ban, 'ban_note': ban_note, 'results': results,
    }


async def run_full_power_batch(batch_per_account: int = 5) -> dict:
    """Запускает пачку инвайтов сразу со всех прогретых аккаунтов (needs_warmup=FALSE).
    Каждый делает batch_per_account инвайтов. Лимит 30/сутки на аккаунт всё равно соблюдается.
    Между инвайтами на одном аккаунте — пауза 90-180 сек.
    Между разными аккаунтами — пауза 30-60 сек.
    """
    accounts = get_full_power_accounts()
    if not accounts:
        return {'ok': False, 'error': 'Нет прогретых аккаунтов с остатком на сегодня'}

    all_results = []
    total_added = 0
    for i, acc in enumerate(accounts):
        # Сколько брать на этот раз: min(batch, остаток дня, что есть в очереди)
        take = min(batch_per_account, acc['daily_remaining'])
        result = await run_warmup_for_account(acc, take)
        all_results.append(result)
        total_added += result.get('added', 0)
        if i < len(accounts) - 1:
            await asyncio.sleep(random.randint(30, 60))

    return {
        'ok': True,
        'mode': 'full_power',
        'batch_per_account': batch_per_account,
        'accounts_processed': len(all_results),
        'total_added': total_added,
        'results': all_results,
    }


async def run_warmup_day() -> dict:
    """Запускает дневную пачку прогрева согласно расписанию."""
    state = get_warmup_state()
    if not state['start_date']:
        # Первый запуск — устанавливаем сегодняшнюю дату как старт
        from datetime import date
        today = str(date.today())
        set_setting('warmup_start_date', today)
        state = get_warmup_state()

    accs_today = state['accounts_today']
    per_acc = state['per_account_today']

    accounts = get_warmup_accounts(accs_today)
    if not accounts:
        return {
            'ok': True, 'state': state,
            'message': f'День {state["day_num"]}: ни один аккаунт сегодня не доступен (либо все уже отработали, либо все в бане)',
            'results': [],
        }

    all_results = []
    for i, acc in enumerate(accounts):
        result = await run_warmup_for_account(acc, per_acc)
        all_results.append(result)
        # Большая пауза между разными аккаунтами (5-15 мин) — но в HTTP не влезет, делаем короче
        if i < len(accounts) - 1:
            await asyncio.sleep(60)  # 1 мин между аккаунтами в одном запуске

    total_added = sum(r.get('added', 0) for r in all_results)
    return {
        'ok': True,
        'state': state,
        'accounts_processed': len(all_results),
        'total_added': total_added,
        'results': all_results,
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
    full_power = get_full_power_accounts()
    full_power_summary = [{
        'id': a['id'], 'label': a['label'],
        'remaining': a['daily_remaining'], 'used': a['daily_invites_used'],
    } for a in full_power]
    return {
        'target_group': get_target_group(),
        'daily_limit': DAILY_INVITE_LIMIT,
        'pause_range_sec': [PAUSE_MIN_SEC, PAUSE_MAX_SEC],
        'max_batch': MAX_BATCH_SIZE,
        'active_account': acc or None,
        'queue': {'pending': row[0], 'added': row[1], 'privacy': row[2], 'failed': row[3]},
        'recent_runs': recent_logs(20),
        'warmup': get_warmup_state(),
        'warmup_schedule': WARMUP_SCHEDULE,
        'full_power_accounts': full_power_summary,
        'full_power_total_remaining': sum(a['daily_remaining'] for a in full_power),
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

    if action == 'warmup_start':
        from datetime import date
        set_setting('warmup_enabled', 'true')
        if not get_setting('warmup_start_date', ''):
            set_setting('warmup_start_date', str(date.today()))
        return resp(200, {'ok': True, 'state': get_warmup_state()})

    if action == 'warmup_stop':
        set_setting('warmup_enabled', 'false')
        return resp(200, {'ok': True, 'state': get_warmup_state()})

    if action == 'warmup_reset':
        from datetime import date
        set_setting('warmup_start_date', str(date.today()))
        return resp(200, {'ok': True, 'state': get_warmup_state()})

    if action == 'warmup_set_day':
        from datetime import date, timedelta
        day = int(body.get('day', 1))
        if day < 1: day = 1
        # Если хотим день N, ставим start_date = today - (N - 1) дней
        new_start = date.today() - timedelta(days=(day - 1))
        set_setting('warmup_start_date', str(new_start))
        return resp(200, {'ok': True, 'state': get_warmup_state()})

    if action == 'warmup_run':
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(run_warmup_day())
            return resp(200, result)
        finally:
            loop.close()

    if action == 'run_full_power':
        batch = int(body.get('batch_per_account', 5))
        if batch < 1: batch = 1
        if batch > MAX_BATCH_SIZE: batch = MAX_BATCH_SIZE
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(run_full_power_batch(batch))
            return resp(200, result)
        finally:
            loop.close()

    if action == 'set_warmup_flag':
        account_id = int(body.get('id', 0))
        needs = bool(body.get('needs_warmup', True))
        if not account_id:
            return resp(400, {'error': 'id required'})
        conn = db(); cur = conn.cursor()
        cur.execute(f"UPDATE {SCHEMA}.tg_user_accounts SET needs_warmup={'TRUE' if needs else 'FALSE'} WHERE id={account_id}")
        conn.commit(); cur.close(); conn.close()
        return resp(200, {'ok': True})

    return resp(400, {'error': 'unknown action'})