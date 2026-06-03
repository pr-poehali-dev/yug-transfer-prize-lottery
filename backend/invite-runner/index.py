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
from telethon.tl.functions.channels import InviteToChannelRequest, GetParticipantRequest, JoinChannelRequest
from telethon.tl.functions.contacts import ResolveUsernameRequest, AddContactRequest
from telethon.tl.types import InputPhoneContact
from telethon.errors import UserNotParticipantError
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


DAILY_INVITE_LIMIT = 100000      # лимит снят: контроль вручную
PAUSE_MIN_SEC = 90               # мин пауза между инвайтами в одной пачке
PAUSE_MAX_SEC = 180              # макс пауза между инвайтами в одной пачке
MAX_BATCH_SIZE = 10              # макс инвайтов за один HTTP-запуск
SINGLE_RUN_MAX = 6               # макс инвайтов за один запуск с ОДНОГО аккаунта (укладывается в таймаут 30с)
TIME_BUDGET_SEC = 18            # жёсткий лимит времени на пачку, чтобы не словить таймаут функции (30с)

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


def get_full_power_accounts(include_warmup: bool = True) -> list:
    """Берёт ВСЕ незабаненные аккаунты с валидной сессией.
    include_warmup=True (по умолчанию) — все незабаненные.
    include_warmup=False — только прогретые (needs_warmup=FALSE)."""
    conn = db(); cur = conn.cursor()
    where = "is_banned=FALSE AND session_string IS NOT NULL AND session_string <> ''"
    if not include_warmup:
        where += " AND needs_warmup=FALSE"
    cur.execute(f"""
        SELECT id, label, phone, session_string,
               COALESCE(daily_invites_used, 0), daily_reset_date
        FROM {SCHEMA}.tg_user_accounts
        WHERE {where}
        ORDER BY id ASC
    """)
    rows = cur.fetchall()
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
        accounts.append({
            'id': r[0], 'label': r[1], 'phone': r[2], 'session_string': r[3],
            'daily_invites_used': used, 'daily_remaining': remaining,
        })
    return accounts


def get_account_by_id(account_id: int) -> dict:
    """Один аккаунт по id (для запуска инвайта именно с него). Возвращает {} если не найден."""
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        SELECT id, label, phone, session_string,
               COALESCE(daily_invites_used, 0), daily_reset_date, is_banned
        FROM {SCHEMA}.tg_user_accounts
        WHERE id = {int(account_id)}
        LIMIT 1
    """)
    r = cur.fetchone()
    cur.execute("SELECT CURRENT_DATE")
    today = cur.fetchone()[0]
    cur.close(); conn.close()
    if not r:
        return {}
    used = int(r[4] or 0)
    reset_date = r[5]
    if reset_date is None or reset_date < today:
        used = 0
    return {
        'id': r[0], 'label': r[1], 'phone': r[2], 'session_string': r[3],
        'daily_invites_used': used, 'daily_remaining': max(0, DAILY_INVITE_LIMIT - used),
        'is_banned': r[6],
    }


def active_run_start(mode: str, title: str, subtitle: str, total: int, estimated_sec: int):
    """Помечает начало запуска в БД."""
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        UPDATE {SCHEMA}.invite_active_run SET
            is_active = TRUE,
            mode = '{esc(mode)}',
            title = '{esc(title[:200])}',
            subtitle = '{esc(subtitle[:200])}',
            total_planned = {int(total)},
            progress_done = 0,
            progress_added = 0,
            progress_privacy = 0,
            progress_failed = 0,
            started_at = NOW(),
            estimated_sec = {int(estimated_sec)},
            last_message = '',
            last_heartbeat = NOW()
        WHERE id = 1
    """)
    conn.commit(); cur.close(); conn.close()


def active_run_progress(done: int = None, done_inc: int = 0, added: int = None, privacy: int = None, failed: int = None, message: str = ''):
    """Обновляет счётчики прогресса.
    done = абсолютное значение, done_inc = +N к текущему."""
    sets = ['last_heartbeat = NOW()']
    if done is not None: sets.append(f"progress_done = {int(done)}")
    elif done_inc: sets.append(f"progress_done = progress_done + {int(done_inc)}")
    if added: sets.append(f"progress_added = progress_added + {int(added)}")
    if privacy: sets.append(f"progress_privacy = progress_privacy + {int(privacy)}")
    if failed: sets.append(f"progress_failed = progress_failed + {int(failed)}")
    if message: sets.append(f"last_message = '{esc(message[:200])}'")
    conn = db(); cur = conn.cursor()
    cur.execute(f"UPDATE {SCHEMA}.invite_active_run SET {', '.join(sets)} WHERE id = 1")
    conn.commit(); cur.close(); conn.close()


def active_run_finish():
    """Снимает флаг активного запуска."""
    conn = db(); cur = conn.cursor()
    cur.execute(f"UPDATE {SCHEMA}.invite_active_run SET is_active = FALSE WHERE id = 1")
    conn.commit(); cur.close(); conn.close()


def get_active_run() -> dict:
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        SELECT is_active, mode, title, subtitle, total_planned,
               progress_done, progress_added, progress_privacy, progress_failed,
               started_at, estimated_sec, last_message, last_heartbeat
        FROM {SCHEMA}.invite_active_run WHERE id = 1
    """)
    r = cur.fetchone(); cur.close(); conn.close()
    if not r:
        return {'is_active': False}
    # Если heartbeat старше 90 секунд — считаем зависшим, чистим
    is_active = r[0]
    heartbeat = r[12]
    if is_active and heartbeat:
        from datetime import datetime, timezone, timedelta
        try:
            hb = heartbeat if heartbeat.tzinfo else heartbeat.replace(tzinfo=timezone.utc)
            if (datetime.now(timezone.utc) - hb) > timedelta(seconds=300):
                active_run_finish()
                return {'is_active': False, 'stale': True}
        except Exception:
            pass
    return {
        'is_active': is_active,
        'mode': r[1], 'title': r[2], 'subtitle': r[3],
        'total_planned': r[4], 'progress_done': r[5],
        'progress_added': r[6], 'progress_privacy': r[7], 'progress_failed': r[8],
        'started_at': str(r[9]) if r[9] else None,
        'estimated_sec': r[10], 'last_message': r[11],
    }


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


def get_pending_targets(limit: int, account_id: int = -1) -> list:
    """АТОМАРНО резервирует limit таргетов: переводит их из pending в in_progress
    и возвращает. Гарантирует что два параллельных аккаунта НЕ возьмут одного юзера.
    account_id>0 — только закреплённые за этим аккаунтом (assigned_account_id=acc_id)
    account_id=0 — только НЕЗАКРЕПЛЁННЫЕ (assigned_account_id IS NULL)
    account_id=-1 — без фильтра (старое поведение, любой pending)."""
    conn = db(); cur = conn.cursor()
    # Сбрасываем «зависшие» in_progress старше 10 минут — это упавшие прошлые запуски.
    # Живые параллельные запуски не пострадают (они работают быстрее 10 минут на батч).
    cur.execute(f"""
        UPDATE {SCHEMA}.invite_targets
        SET status = 'pending'
        WHERE status = 'in_progress'
          AND id IN (
            SELECT id FROM {SCHEMA}.invite_targets
            WHERE status = 'in_progress'
            ORDER BY id ASC LIMIT 200
          )
          AND NOT EXISTS (
            SELECT 1 FROM {SCHEMA}.invite_run_log
            WHERE created_at > NOW() - INTERVAL '10 minutes'
              AND created_at < NOW()
          )
    """)
    conn.commit()
    # UPDATE ... RETURNING с CTE — атомарная операция в postgres.
    # SKIP LOCKED — на случай если другая транзакция уже захватила строку.
    if account_id > 0:
        assigned_filter = f"AND assigned_account_id = {int(account_id)}"
    elif account_id == 0:
        assigned_filter = "AND assigned_account_id IS NULL"
    else:
        assigned_filter = ""
    cur.execute(f"""
        WITH picked AS (
            SELECT id FROM {SCHEMA}.invite_targets
            WHERE status='pending' AND username IS NOT NULL AND username <> ''
            {assigned_filter}
            ORDER BY id ASC
            LIMIT {int(limit)}
            FOR UPDATE SKIP LOCKED
        )
        UPDATE {SCHEMA}.invite_targets t
        SET status = 'in_progress'
        FROM picked
        WHERE t.id = picked.id
        RETURNING t.id, t.username, t.phone, t.first_name
    """)
    rows = cur.fetchall()
    conn.commit(); cur.close(); conn.close()
    return [{'id': r[0], 'username': r[1], 'phone': r[2], 'first_name': r[3]} for r in rows]


def release_targets(target_ids: list) -> None:
    """Возвращает зарезервированные (in_progress) таргеты обратно в pending,
    если их не успели обработать (ранний выход: нет сессии/группы/ошибка). Без этого они зависают."""
    ids = [int(i) for i in target_ids if i]
    if not ids:
        return
    conn = db(); cur = conn.cursor()
    cur.execute(
        f"UPDATE {SCHEMA}.invite_targets SET status='pending' "
        f"WHERE status='in_progress' AND id IN ({','.join(str(i) for i in ids)})"
    )
    conn.commit(); cur.close(); conn.close()


def distribute_pending_to_accounts(account_ids: list, force: bool = False) -> dict:
    """Равномерно распределяет всех pending-кандидатов между переданными аккаунтами (round-robin по id).
    force=False — перезаписывает assigned_account_id только для незакреплённых (NULL) или закреплённых
                  за аккаунтами вне активного списка. Уже закреплённые за активным аккаунтом — не трогаем.
    force=True  — СБРАСЫВАЕТ все закрепления и раздаёт заново поровну (для кнопки «Разделить поровну»).
    Возвращает {account_id: count}."""
    if not account_ids:
        return {}
    ids_csv = ','.join(str(int(a)) for a in account_ids)
    conn = db(); cur = conn.cursor()
    if force:
        # Полный сброс: снимаем все закрепления у всех pending, чтобы раздать строго поровну
        cur.execute(f"""
            UPDATE {SCHEMA}.invite_targets
            SET assigned_account_id = NULL
            WHERE status = 'pending'
        """)
    else:
        # Снимаем закрепления только для аккаунтов вне активного списка (бан/отключение)
        cur.execute(f"""
            UPDATE {SCHEMA}.invite_targets
            SET assigned_account_id = NULL
            WHERE status = 'pending'
              AND assigned_account_id IS NOT NULL
              AND assigned_account_id NOT IN ({ids_csv})
        """)
    # 2) Round-robin раздача незакреплённых
    cur.execute(f"""
        WITH unassigned AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn
            FROM {SCHEMA}.invite_targets
            WHERE status = 'pending'
              AND assigned_account_id IS NULL
              AND username IS NOT NULL AND username <> ''
        ),
        accs AS (
            SELECT acc_id, ROW_NUMBER() OVER (ORDER BY acc_id) AS rn
            FROM (VALUES {','.join(f'({int(a)})' for a in account_ids)}) AS v(acc_id)
        )
        UPDATE {SCHEMA}.invite_targets t
        SET assigned_account_id = a.acc_id
        FROM unassigned u
        JOIN accs a ON a.rn = ((u.rn - 1) % {len(account_ids)}) + 1
        WHERE t.id = u.id
    """)
    conn.commit()
    # 3) Считаем итог
    cur.execute(f"""
        SELECT assigned_account_id, COUNT(*)
        FROM {SCHEMA}.invite_targets
        WHERE status = 'pending' AND assigned_account_id IN ({ids_csv})
        GROUP BY assigned_account_id
    """)
    rows = cur.fetchall()
    cur.close(); conn.close()
    return {int(r[0]): int(r[1]) for r in rows}


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
    # Сначала берём закреплённых за этим аккаунтом, потом — незакреплённых (NULL)
    targets = get_pending_targets(take, account_id=acc['id'])
    if not targets:
        targets = get_pending_targets(take, account_id=0)
    if not targets:
        return {'ok': True, 'message': 'В очереди нет кандидатов со статусом pending.', 'attempted': 0}

    estimated = take * 135
    active_run_start(
        mode='batch',
        title=f'Ручной запуск: {take} инвайтов с «{acc["label"]}»',
        subtitle='Пауза 90-180 сек между инвайтами',
        total=take, estimated_sec=estimated,
    )

    client = TelegramClient(StringSession(acc['session_string']), api_id, api_hash)
    await client.connect()

    # Проверка авторизации с двумя попытками — чтобы не банить из-за сетевой икоты
    authorized = False
    for _ in range(2):
        try:
            if await client.is_user_authorized():
                authorized = True
                break
        except Exception:
            pass
        await asyncio.sleep(1)
    if not authorized:
        await client.disconnect()
        # НЕ помечаем баном автоматически — может быть временная проблема со связью.
        # Просто переключимся на следующий аккаунт.
        nxt = pick_next_account_id()
        if nxt:
            switch_active(nxt)
        return {'ok': False, 'error': f'Сессия аккаунта «{acc["label"]}» не отвечает. Переключились на следующий, аккаунт оставлен активным — проверь вручную если повторится.'}

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
                # резолв — НЕ инвайт. Сюда может прилететь FloodWait просто за частые
                # get_entity. Это не бан — просто подождать. Помечаем только если ОЧЕНЬ долго.
                if fw.seconds > 21600:  # 6 часов — почти наверняка реальная блокировка
                    ban_triggered = True
                break
            except Exception as e:
                update_target(t['id'], 'failed', f'resolve: {e}', acc['id'])
                failed += 1
                results.append({'username': uname, 'status': 'failed', 'reason': str(e)[:120]})
                continue

            # Фильтр: если это канал/чат (а не пользователь) — пропускаем
            from telethon.tl.types import User as _TLUser
            if not isinstance(user_entity, _TLUser):
                update_target(t['id'], 'failed', 'это канал/чат, а не пользователь', acc['id'])
                failed += 1
                results.append({'username': uname, 'status': 'failed', 'reason': 'не пользователь'})
                continue

            try:
                await client(InviteToChannelRequest(channel=target_entity, users=[user_entity]))
                # ВАЖНО: Telegram может вернуть "успех" но НЕ добавить юзера
                # (тихий PEER_FLOOD, privacy и т.п.). Проверяем реальное участие.
                really_in_group = False
                try:
                    await client(GetParticipantRequest(channel=target_entity, participant=user_entity))
                    really_in_group = True
                except UserNotParticipantError:
                    really_in_group = False
                except Exception:
                    # Если проверка сломалась — считаем что добавили, чтобы не дублить попытки
                    really_in_group = True

                if really_in_group:
                    update_target(t['id'], 'added', '', acc['id'])
                    increment_account_usage(acc['id'])
                    added += 1
                    results.append({'username': uname, 'status': 'added'})
                else:
                    # Telegram «проглотил» инвайт но юзера в группе нет
                    update_target(t['id'], 'failed', 'silent_drop: not in group after invite', acc['id'])
                    failed += 1
                    results.append({'username': uname, 'status': 'failed', 'reason': 'silent_drop'})
            except UserPrivacyRestrictedError:
                update_target(t['id'], 'privacy', 'USER_PRIVACY_RESTRICTED', acc['id'])
                privacy += 1
                results.append({'username': uname, 'status': 'privacy'})
            except UserAlreadyParticipantError:
                # already_in — НЕ инкрементим счётчик, т.к. это не новое добавление
                update_target(t['id'], 'added', 'already in group', acc['id'])
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
                # PEER_FLOOD на самом первом юзере без единого успешного инвайта =
                # часто это «проблемный кандидат» (битый username / уже кикнут), а не бан аккаунта.
                # Реальный бан = PEER_FLOOD после нескольких успешных добавлений.
                if added >= 1:
                    ban_triggered = True
                    ban_note = f'PeerFloodError на {uname} (после {added} успешных)'
                else:
                    # Помечаем кандидата как проблемного и НЕ баним аккаунт
                    update_target(t['id'], 'failed', 'PEER_FLOOD на первой попытке (битый кандидат)', acc['id'])
                    failed += 1
                    ban_note = f'PEER_FLOOD на {uname} (пропущен, аккаунт оставлен живым)'
                results.append({'username': uname, 'status': 'flood', 'reason': 'PEER_FLOOD'})
                break
            except FloodWaitError as fw:
                ban_note = f'FloodWait {fw.seconds}s на {uname}'
                # FloodWait — это «подожди X секунд», аккаунт ЖИВОЙ.
                # Считаем баном только при очень долгом ожидании (сутки+).
                if fw.seconds > 86400:
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

            # обновляем прогресс
            try:
                last = results[-1] if results else {}
                active_run_progress(
                    done=attempted,
                    message=f'@{last.get("username", "")} → {last.get("status", "")}',
                )
            except Exception:
                pass

            # пауза между инвайтами (кроме последнего)
            if i < len(targets) - 1 and not ban_triggered:
                pause = random.randint(PAUSE_MIN_SEC, PAUSE_MAX_SEC)
                await asyncio.sleep(pause)

    finally:
        await client.disconnect()
        active_run_finish()

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

    # Фильтр: если это канал/чат, а не пользователь — пропускаем
    from telethon.tl.types import User as _TLUser
    if not isinstance(user_entity, _TLUser):
        update_target(target['id'], 'failed', 'это канал/чат, а не пользователь', account_id)
        return {'username': uname, 'status': 'failed', 'reason': 'не пользователь'}

    try:
        await client(InviteToChannelRequest(channel=target_entity, users=[user_entity]))
        # ВАЖНО: Telegram может вернуть «успех» БЕЗ исключения, но юзер не добавлен
        # (тихий PEER_FLOOD/privacy/настройка группы «только взаимные контакты»).
        # Проверяем реально ли юзер в группе.
        really_in_group = False
        try:
            await client(GetParticipantRequest(channel=target_entity, participant=user_entity))
            really_in_group = True
        except UserNotParticipantError:
            really_in_group = False
        except Exception:
            # Если проверка сломалась — считаем что добавили (чтобы не дублить попытки)
            really_in_group = True
        if really_in_group:
            update_target(target['id'], 'added', '', account_id)
            increment_account_usage(account_id)
            return {'username': uname, 'status': 'added'}
        else:
            update_target(target['id'], 'failed', 'silent_drop: not in group after invite', account_id)
            return {'username': uname, 'status': 'failed', 'reason': 'silent_drop'}
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


async def run_warmup_for_account(acc: dict, per_account: int, fast: bool = False) -> dict:
    """Делает per_account инвайтов с одного аккаунта.
    fast=False — пауза 90-180 сек (безопасно, для прогрева).
    fast=True  — без пауз (быстрый режим «полной мощности» — 1 клик = 10 инвайтов мгновенно)."""
    func_start = time.time()
    api_id = int(os.environ['TG_API_ID'])
    api_hash = os.environ['TG_API_HASH']
    target_group = get_target_group()

    # Сначала берём закреплённых за этим аккаунтом
    targets = get_pending_targets(per_account, account_id=acc['id'])
    # Если своих не хватает — добираем НЕЗАКРЕПЛЁННЫХ (assigned IS NULL), не трогая чужих
    if len(targets) < per_account:
        extra = get_pending_targets(per_account - len(targets), account_id=0)
        targets = targets + extra
    if not targets:
        return {'ok': False, 'account': acc['label'], 'error': 'Нет pending кандидатов для этого аккаунта'}

    client = TelegramClient(StringSession(acc['session_string']), api_id, api_hash)
    added = 0; privacy = 0; failed = 0; ban = False; ban_note = ''
    results = []

    try:
        # Подключение к Telegram бывает «холодным» и поднимается не сразу —
        # даём несколько попыток connect + проверки авторизации (до ~8 сек).
        authorized = False
        for attempt in range(5):
            try:
                if not client.is_connected():
                    await client.connect()
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
            # НЕ баним сразу — может быть сетевая проблема. Просто пропустим этот запуск.
            release_targets([t['id'] for t in targets])
            return {'ok': False, 'account': acc['label'], 'error': 'Сессия не отвечает (Telegram не поднял соединение), пропустили — аккаунт остался активным, попробуй ещё раз'}
        try:
            target_entity = await client.get_entity(target_group)
        except Exception as e:
            release_targets([t['id'] for t in targets])
            return {'ok': False, 'account': acc['label'], 'error': f'Группа {target_group}: {e}. Аккаунт «{acc["label"]}» должен быть участником группы.'}

        for i, t in enumerate(targets):
            # Защита от таймаута функции: если бюджет времени исчерпан — мягко останавливаемся
            if time.time() - func_start > TIME_BUDGET_SEC:
                ban_note = f'Пачка остановлена по таймеру ({TIME_BUDGET_SEC}с) — добавлено {added}, остальные вернутся в очередь'
                active_run_progress(message=ban_note)
                break
            r = await invite_one_user(client, target_entity, t, acc['id'])
            results.append(r)
            inc_added = inc_priv = inc_fail = 0
            if r['status'] == 'added' or r['status'] == 'already_in':
                added += 1; inc_added = 1
            elif r['status'] == 'privacy':
                privacy += 1; inc_priv = 1
            elif r['status'] in ('peer_flood',):
                # Бан только если PEER_FLOOD пришёл ПОСЛЕ успешных инвайтов.
                # Если упали на первом юзере — это битый кандидат, не бан аккаунта.
                if added >= 1:
                    ban = True; ban_note = f'PEER_FLOOD на {r["username"]} (после {added} успешных)'
                else:
                    # помечаем кандидата failed (он уже отмечен в update_target внутри invite_one_user),
                    # дополнительно проставим причину
                    update_target(t['id'], 'failed', 'PEER_FLOOD на первой попытке (битый кандидат)', acc['id'])
                    failed += 1
                    ban_note = f'PEER_FLOOD на {r["username"]} (пропущен, аккаунт оставлен живым)'
                active_run_progress(message=ban_note); break
            elif r['status'] == 'flood_wait' and r.get('fw_seconds', 0) > 86400:
                # FloodWait сутки+ — реальный признак проблемы. Меньше — просто пауза, аккаунт живой.
                ban = True; ban_note = f'FloodWait {r.get("fw_seconds")}s'
                active_run_progress(message=ban_note); break
            elif r['status'] == 'flood_wait':
                # Короткий FloodWait — НЕ бан. Просто стопаем батч, аккаунт остаётся активным.
                ban_note = f'FloodWait {r.get("fw_seconds")}s — подождём, аккаунт живой'
                active_run_progress(message=ban_note); break
            elif r['status'] == 'no_rights':
                ban_note = f'Нет прав: {r["reason"]}'
                active_run_progress(message=ban_note); break
            else:
                failed += 1; inc_fail = 1

            try:
                active_run_progress(
                    done_inc=1,
                    added=inc_added, privacy=inc_priv, failed=inc_fail,
                    message=f'{acc["label"]}: @{r["username"]} → {r["status"]}'
                )
            except Exception:
                pass

            if i < len(targets) - 1 and not ban:
                if fast:
                    # Быстрый режим: мини-пауза 0.3-0.8 сек чтобы не получить мгновенный flood от API
                    await asyncio.sleep(random.uniform(0.3, 0.8))
                else:
                    await asyncio.sleep(random.randint(PAUSE_MIN_SEC, PAUSE_MAX_SEC))
    finally:
        # Возвращаем в очередь все таргеты, которые зарезервировали, но не успели обработать
        # (остановка по таймеру/флуду/прерыванию) — иначе они зависнут в in_progress.
        release_targets([t['id'] for t in targets])
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
    """Запускает пачку инвайтов сразу со ВСЕХ незабаненных аккаунтов параллельно.
    Очередь делится атомарно через FOR UPDATE SKIP LOCKED — каждый аккаунт берёт свой кусок."""
    accounts = get_full_power_accounts(include_warmup=True)
    if not accounts:
        return {'ok': False, 'error': 'Нет доступных аккаунтов'}

    # Равномерно закрепляем pending за каждым аккаунтом — чтобы разные аккаунты НЕ добавляли одного юзера
    distribute_pending_to_accounts([a['id'] for a in accounts])

    total = sum(min(batch_per_account, a['daily_remaining']) for a in accounts)
    estimated = max(5, batch_per_account * 2)
    active_run_start(
        mode='full_power',
        title=f'Залп ×{batch_per_account}: {total} человек',
        subtitle=f'{len(accounts)} аккаунтов параллельно',
        total=total, estimated_sec=estimated,
    )

    all_results: list = []
    total_added = 0
    accounts_used: list = []
    try:
        tasks = []
        labels = []
        for acc in accounts:
            take = min(batch_per_account, acc['daily_remaining'])
            if take <= 0:
                continue
            accounts_used.append({'id': acc['id'], 'label': acc['label'], 'take': take})
            labels.append(acc['label'])
            tasks.append(run_warmup_for_account(acc, take, fast=True))
        raw_results = await asyncio.gather(*tasks, return_exceptions=True)
        for i, r in enumerate(raw_results):
            label = labels[i] if i < len(labels) else f'acc#{i}'
            if isinstance(r, Exception):
                # КРИТИЧНО: логируем падение аккаунта в run_log чтобы было видно в UI
                acc_id = accounts_used[i]['id'] if i < len(accounts_used) else 0
                err_msg = f'CRASH: {type(r).__name__}: {str(r)[:200]}'
                try:
                    log_run(acc_id, 0, 0, 0, 0, False, err_msg)
                except Exception:
                    pass
                all_results.append({'ok': False, 'account': label, 'account_id': acc_id, 'added': 0, 'error': err_msg})
                continue
            all_results.append(r)
            total_added += r.get('added', 0)
    finally:
        active_run_finish()

    return {
        'ok': True,
        'mode': 'full_power',
        'batch_per_account': batch_per_account,
        'accounts_processed': len(all_results),
        'accounts_planned': accounts_used,
        'total_added': total_added,
        'results': all_results,
    }


async def run_single_account_batch(account_id: int, size: int = SINGLE_RUN_MAX) -> dict:
    """Заливает в группу никнеймы С ОДНОГО выбранного аккаунта (до SINGLE_RUN_MAX за раз).
    Берёт сначала закреплённых за аккаунтом кандидатов, потом незакреплённых."""
    if size < 1:
        size = 1
    if size > SINGLE_RUN_MAX:
        size = SINGLE_RUN_MAX

    acc = get_account_by_id(account_id)
    if not acc:
        return {'ok': False, 'error': 'Аккаунт не найден'}
    if acc.get('is_banned'):
        return {'ok': False, 'error': f'Аккаунт «{acc["label"]}» забанен'}
    if acc['daily_remaining'] <= 0:
        return {'ok': False, 'error': f'У «{acc["label"]}» исчерпан дневной лимит'}

    take = min(size, acc['daily_remaining'])

    active_run_start(
        mode='single_account',
        title=f'Заливка с «{acc["label"]}»: до {take} человек',
        subtitle='Один аккаунт по очереди',
        total=take, estimated_sec=max(5, take * 2),
    )
    try:
        # run_warmup_for_account сам берёт закреплённых за этим аккаунтом,
        # а если их не хватает — добирает незакреплённых (не трогая кандидатов других аккаунтов).
        result = await run_warmup_for_account(acc, take, fast=True)
    finally:
        active_run_finish()

    # Если внутри была причина не обработать никого (нет прав/группа/сессия) — показываем её,
    # а не молчаливые «0 добавлено».
    if result.get('ok') is False:
        return {
            'ok': False,
            'mode': 'single_account',
            'account': {'id': acc['id'], 'label': acc['label']},
            'error': result.get('error', 'Не удалось выполнить заливку'),
        }

    return {
        'ok': True,
        'mode': 'single_account',
        'account': {'id': acc['id'], 'label': acc['label']},
        'requested': take,
        'added': result.get('added', 0),
        'privacy': result.get('privacy', 0),
        'failed': result.get('failed', 0),
        'ban_triggered': result.get('ban_triggered', False) or result.get('ban', False),
        'result': result,
    }


def get_unchecked_pending(limit: int) -> list:
    """Берёт pending-кандидатов с username для проверки на существование (по порядку id)."""
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        SELECT id, username FROM {SCHEMA}.invite_targets
        WHERE status='pending' AND username IS NOT NULL AND username <> ''
        ORDER BY id ASC
        LIMIT {int(limit)}
    """)
    rows = cur.fetchall(); cur.close(); conn.close()
    return [{'id': r[0], 'username': r[1]} for r in rows]


def mark_bad_username(target_id: int, reason: str):
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        UPDATE {SCHEMA}.invite_targets
        SET status='bad_username', error='{esc(reason[:200])}', assigned_account_id=NULL
        WHERE id={int(target_id)}
    """)
    conn.commit(); cur.close(); conn.close()


def count_pending_with_username() -> int:
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        SELECT COUNT(*) FROM {SCHEMA}.invite_targets
        WHERE status='pending' AND username IS NOT NULL AND username <> ''
    """)
    n = cur.fetchone()[0]; cur.close(); conn.close()
    return int(n)


async def verify_usernames(batch: int = 250) -> dict:
    """Проверяет пачку pending-юзернеймов: существует ли аккаунт в Telegram.
    Несуществующие/битые помечает статусом 'bad_username' (убирает из очереди).
    Возвращает сколько проверено / живых / удалено и сколько осталось проверить."""
    api_id = int(os.environ['TG_API_ID'])
    api_hash = os.environ['TG_API_HASH']

    # Собираем список кандидатов-аккаунтов: сначала активный, потом все остальные живые
    candidates = []
    active = get_active_account()
    if active and active.get('session_string'):
        candidates.append(active)
    for a in get_full_power_accounts(include_warmup=True):
        if a.get('session_string') and all(a['id'] != c['id'] for c in candidates):
            candidates.append(a)
    if not candidates:
        return {'ok': False, 'error': 'Нет живого аккаунта для проверки'}

    targets = get_unchecked_pending(batch)
    if not targets:
        return {'ok': True, 'checked': 0, 'alive': 0, 'removed': 0, 'remaining': 0, 'done': True}

    total_to_check = count_pending_with_username()
    active_run_start(
        mode='verify',
        title=f'Проверка юзернеймов: пачка {len(targets)}',
        subtitle=f'Осталось проверить: {total_to_check}',
        total=len(targets), estimated_sec=max(5, len(targets) // 5),
    )

    # Перебираем аккаунты, пока какой-то не подключится и не авторизуется
    client = None
    acc = None
    tried_labels = []
    for cand in candidates:
        tried_labels.append(cand['label'])
        c = TelegramClient(StringSession(cand['session_string']), api_id, api_hash)
        try:
            await c.connect()
            authorized = False
            for _ in range(2):
                try:
                    if await c.is_user_authorized():
                        authorized = True
                        break
                except Exception:
                    pass
                await asyncio.sleep(1)
            if authorized:
                client = c
                acc = cand
                break
            else:
                await c.disconnect()
        except Exception:
            try:
                await c.disconnect()
            except Exception:
                pass
    if client is None or acc is None:
        active_run_finish()
        return {'ok': False, 'error': f'Ни одна сессия не отвечает (пробовали: {", ".join(tried_labels)})'}

    checked = 0; alive = 0; removed = 0
    from telethon.tl.types import User as _TLUser
    try:
        loop_start = time.time()
        for i, t in enumerate(targets):
            # Защита от таймаута функции (30с) — выходим заранее, остальное проверим в след. пачке
            if time.time() - loop_start > TIME_BUDGET_SEC:
                break
            checked += 1
            uname = t['username']
            try:
                ent = await client.get_entity(uname)
                if isinstance(ent, _TLUser):
                    alive += 1
                else:
                    mark_bad_username(t['id'], 'не пользователь (канал/чат)')
                    removed += 1
            except (UsernameInvalidError, UsernameNotOccupiedError, ValueError):
                mark_bad_username(t['id'], 'username не существует')
                removed += 1
            except FloodWaitError as fw:
                # Telegram просит подождать — стопаем пачку, аккаунт живой
                active_run_progress(message=f'FloodWait {fw.seconds}s — пауза, повтори позже')
                break
            except Exception:
                # неизвестная ошибка резолва — оставляем как есть (alive не считаем, но и не удаляем)
                pass
            try:
                active_run_progress(done=checked, message=f'@{uname}: {"жив" if alive else ""}')
            except Exception:
                pass
            # лёгкая пауза, чтобы не словить flood
            await asyncio.sleep(random.uniform(0.2, 0.5))
    finally:
        await client.disconnect()
        active_run_finish()

    remaining = max(0, count_pending_with_username())
    done = remaining == 0
    redistributed = None
    # Когда проверка завершена — автоматически раскидываем живых поровну по аккаунтам
    if done:
        try:
            accs_all = get_full_power_accounts(include_warmup=True)
            if accs_all:
                counts = distribute_pending_to_accounts([a['id'] for a in accs_all], force=True)
                redistributed = {'accounts': len(accs_all), 'total': sum(counts.values())}
        except Exception as e:
            redistributed = {'error': str(e)[:120]}
    return {
        'ok': True, 'account': acc['label'],
        'checked': checked, 'alive': alive, 'removed': removed,
        'remaining': remaining, 'done': done,
        'redistributed': redistributed,
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

    # Равномерно закрепляем pending за каждым аккаунтом — один юзер = один аккаунт
    distribute_pending_to_accounts([a['id'] for a in accounts])

    total = len(accounts) * per_acc
    estimated = total * 135 + max(0, len(accounts) - 1) * 60
    active_run_start(
        mode='warmup',
        title=f'Прогрев день {state["day_num"]}: {len(accounts)} × {per_acc} = {total} человек',
        subtitle='Пауза 90-180 сек между инвайтами',
        total=total, estimated_sec=estimated,
    )

    all_results = []
    try:
        for i, acc in enumerate(accounts):
            result = await run_warmup_for_account(acc, per_acc)
            all_results.append(result)
            if i < len(accounts) - 1:
                await asyncio.sleep(60)
    finally:
        active_run_finish()

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
        'active_run': get_active_run(),
    }


async def mutual_warmup_one_account(me: dict, others: list, send_hello: bool, join_channel: bool) -> dict:
    """Один аккаунт сохраняет ВСЕХ остальных в контакты, пишет «Привет» и подписывается на канал."""
    api_id = int(os.environ['TG_API_ID'])
    api_hash = os.environ['TG_API_HASH']
    target_group = get_target_group()

    client = TelegramClient(StringSession(me['session_string']), api_id, api_hash)
    await client.connect()
    contacts_added = 0
    messages_sent = 0
    channel_joined = False
    errors: list = []

    try:
        if not await client.is_user_authorized():
            return {'ok': False, 'account': me['label'], 'error': 'сессия не отвечает'}

        # 1) подписка на целевой канал/группу (на всякий случай — для «активности»)
        if join_channel and target_group:
            try:
                entity = await client.get_entity(target_group)
                await client(JoinChannelRequest(entity))
                channel_joined = True
            except Exception as e:
                errors.append(f'join {target_group}: {type(e).__name__}')

        # 2) проходим по всем «другим» аккаунтам
        for o in others:
            if o['id'] == me['id']:
                continue
            label = o['label']
            phone = (o.get('phone') or '').replace('+', '').strip()
            try:
                # Резолвим юзера: сначала по телефону (если есть), иначе пропуск
                user_entity = None
                if phone:
                    # AddContactRequest принимает user_id, который надо сначала получить.
                    # Получим через ImportContacts (по телефону) — он же сразу добавит в книгу.
                    from telethon.tl.functions.contacts import ImportContactsRequest
                    contact = InputPhoneContact(client_id=0, phone=phone, first_name=label[:30] or 'Friend', last_name='')
                    res = await client(ImportContactsRequest(contacts=[contact]))
                    if res.users:
                        user_entity = res.users[0]
                        contacts_added += 1
                    else:
                        errors.append(f'{label}: не нашёлся по телефону')
                        continue
                else:
                    errors.append(f'{label}: нет phone в БД')
                    continue

                # 3) «Привет» в личку
                if send_hello and user_entity:
                    try:
                        await client.send_message(user_entity, 'Привет!')
                        messages_sent += 1
                    except Exception as e:
                        errors.append(f'msg {label}: {type(e).__name__}')

                await asyncio.sleep(random.uniform(1.5, 3.0))
            except FloodWaitError as fw:
                errors.append(f'FloodWait {fw.seconds}s — стоп')
                break
            except Exception as e:
                errors.append(f'{label}: {type(e).__name__}: {str(e)[:80]}')
    finally:
        await client.disconnect()

    return {
        'ok': True,
        'account': me['label'],
        'account_id': me['id'],
        'contacts_added': contacts_added,
        'messages_sent': messages_sent,
        'channel_joined': channel_joined,
        'errors': errors[:10],
    }


async def run_mutual_warmup(send_hello: bool = True, join_channel: bool = True) -> dict:
    """Все аккаунты добавляют друг друга в контакты параллельно. Это «прогрев своих»."""
    accounts = get_full_power_accounts(include_warmup=True)
    if len(accounts) < 2:
        return {'ok': False, 'error': 'Нужно минимум 2 аккаунта'}

    active_run_start(
        mode='mutual_warmup',
        title=f'Прогрев своих: {len(accounts)} аккаунтов',
        subtitle='Дружим аккаунты между собой',
        total=len(accounts) * (len(accounts) - 1),
        estimated_sec=max(30, len(accounts) * 15),
    )

    try:
        tasks = [mutual_warmup_one_account(a, accounts, send_hello, join_channel) for a in accounts]
        raw = await asyncio.gather(*tasks, return_exceptions=True)
        results = []
        for i, r in enumerate(raw):
            if isinstance(r, Exception):
                results.append({'ok': False, 'account': accounts[i]['label'], 'error': f'{type(r).__name__}: {str(r)[:120]}'})
            else:
                results.append(r)
    finally:
        active_run_finish()

    total_contacts = sum(r.get('contacts_added', 0) for r in results if r.get('ok'))
    total_messages = sum(r.get('messages_sent', 0) for r in results if r.get('ok'))
    return {
        'ok': True,
        'accounts': len(accounts),
        'total_contacts_added': total_contacts,
        'total_messages_sent': total_messages,
        'results': results,
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

    if action == 'run_account':
        account_id = int(body.get('account_id', 0))
        size = int(body.get('size', SINGLE_RUN_MAX))
        if not account_id:
            return resp(400, {'error': 'account_id required'})
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(run_single_account_batch(account_id, size))
            return resp(200, result)
        finally:
            loop.close()

    if action == 'verify_usernames':
        batch = int(body.get('batch', 250))
        if batch < 1: batch = 1
        if batch > 500: batch = 500
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(verify_usernames(batch))
            return resp(200, result)
        finally:
            loop.close()

    if action == 'cancel_run':
        active_run_finish()
        return resp(200, {'ok': True})

    if action == 'distribute_queue':
        # Ручное равное распределение очереди по всем активным незабаненным аккаунтам
        accounts = get_full_power_accounts(include_warmup=True)
        if not accounts:
            return resp(200, {'ok': False, 'error': 'Нет доступных аккаунтов'})
        counts = distribute_pending_to_accounts([a['id'] for a in accounts], force=True)
        return resp(200, {
            'ok': True,
            'accounts': [{'id': a['id'], 'label': a['label'], 'assigned': counts.get(a['id'], 0)} for a in accounts],
            'total_assigned': sum(counts.values()),
        })

    if action == 'mutual_warmup':
        send_hello = bool(body.get('send_hello', True))
        join_channel = bool(body.get('join_channel', True))
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(run_mutual_warmup(send_hello, join_channel))
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