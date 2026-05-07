"""Парсер участников группы @UG_DRIVER в БД.

GET                       — статистика
GET ?action=list          — список участников (?limit=50&offset=0&q=...)
POST ?action=parse        — запустить новый парсинг (чанк букв с time-limit)
POST ?action=parse_continue — продолжить незавершённый парсинг (следующий чанк)
"""
import os
import json
import time
import string
import hashlib
import asyncio
import psycopg2

from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.tl.functions.channels import GetParticipantsRequest
from telethon.tl.types import ChannelParticipantsSearch

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
}
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')
TARGET_GROUP = '@UG_DRIVER'

# Алфавит для перебора (Telethon aggressive делает то же самое).
# Разбили на массив, чтобы между вызовами помнить позицию.
ALPHABET = ['', ' '] + list(string.ascii_lowercase) + list('абвгдеёжзийклмнопрстуфхцчшщъыьэюя') + list(string.digits)
TIME_LIMIT_SEC = 22  # макс. время одного запуска (укладываемся в 30 сек таймаута)


def verify_token(token: str) -> bool:
    admin_login = os.environ.get('ADMIN_LOGIN', '')
    admin_password = os.environ.get('ADMIN_PASSWORD', '')
    base = f"{admin_login}:{admin_password}:admin_secret_2026"
    return token == hashlib.sha256(base.encode()).hexdigest()


def esc(s) -> str:
    return str(s or '').replace("'", "''")


def resp(status: int, body) -> dict:
    return {'statusCode': status, 'headers': CORS, 'body': json.dumps(body, default=str)}


def db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def get_session2() -> str:
    conn = db(); cur = conn.cursor()
    cur.execute(f"SELECT session_string FROM {SCHEMA}.tg_user_session2 WHERE id=1 AND logged_in=TRUE")
    r = cur.fetchone()
    cur.close(); conn.close()
    return r[0] if r else ''


def get_stats() -> dict:
    conn = db(); cur = conn.cursor()
    cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.ug_driver_members")
    total = cur.fetchone()[0]
    cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.ug_driver_members WHERE username IS NOT NULL AND username <> ''")
    with_username = cur.fetchone()[0]
    cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.ug_driver_members WHERE is_bot=TRUE")
    bots = cur.fetchone()[0]
    cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.ug_driver_members WHERE status='excluded'")
    excluded = cur.fetchone()[0]
    cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.ug_driver_members WHERE status='member'")
    members = cur.fetchone()[0]
    cur.execute(
        f"SELECT id, started_at, finished_at, status, total_fetched, new_members, updated_members, error "
        f"FROM {SCHEMA}.ug_driver_parse_runs ORDER BY id DESC LIMIT 1"
    )
    last = cur.fetchone()
    cur.close(); conn.close()
    last_run = None
    if last:
        last_run = {
            'id': last[0], 'started_at': last[1], 'finished_at': last[2],
            'status': last[3], 'total_fetched': last[4],
            'new_members': last[5], 'updated_members': last[6], 'error': last[7],
        }
    return {'total': total, 'with_username': with_username, 'bots': bots,
            'excluded': excluded, 'members': members, 'last_run': last_run}


def get_list(limit: int, offset: int, q: str, status_filter: str = '', group_filter: str = '') -> dict:
    where = "WHERE 1=1"
    if status_filter in ('member', 'excluded'):
        where += f" AND status='{status_filter}'"
    if group_filter:
        where += f" AND source_group='{esc(group_filter)}'"
    if q:
        qe = esc(q)
        where += f" AND (username ILIKE '%{qe}%' OR first_name ILIKE '%{qe}%' OR last_name ILIKE '%{qe}%' OR CAST(user_id AS TEXT) ILIKE '%{qe}%')"
    conn = db(); cur = conn.cursor()
    cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.ug_driver_members {where}")
    total = cur.fetchone()[0]
    cur.execute(
        f"SELECT user_id, username, first_name, last_name, is_bot, is_premium, status, source_group, last_parsed_at "
        f"FROM {SCHEMA}.ug_driver_members {where} "
        f"ORDER BY last_parsed_at DESC LIMIT {int(limit)} OFFSET {int(offset)}"
    )
    items = []
    for r in cur.fetchall():
        items.append({
            'user_id': r[0], 'username': r[1] or '', 'first_name': r[2] or '',
            'last_name': r[3] or '', 'is_bot': r[4], 'is_premium': r[5],
            'status': r[6], 'source_group': r[7] or '', 'last_parsed_at': r[8],
        })
    cur.close(); conn.close()
    return {'total': total, 'items': items}


def get_groups() -> list:
    conn = db(); cur = conn.cursor()
    cur.execute(
        f"SELECT source_group, COUNT(*) FROM {SCHEMA}.ug_driver_members "
        f"WHERE source_group IS NOT NULL AND source_group <> '' "
        f"GROUP BY source_group ORDER BY COUNT(*) DESC"
    )
    items = [{'group': r[0], 'count': r[1]} for r in cur.fetchall()]
    cur.close(); conn.close()
    return items


def normalize_group(g: str) -> str:
    """Нормализуем ссылку/юзернейм группы к виду @username или t.me/joinchat/..."""
    g = (g or '').strip()
    if not g:
        return TARGET_GROUP
    if g.startswith('https://t.me/') or g.startswith('http://t.me/') or g.startswith('t.me/'):
        return g
    if g.startswith('@'):
        return g
    return '@' + g


def get_or_create_run(new_run: bool, source_group: str) -> tuple:
    """Возвращает (run_id, alphabet_pos, source_group)."""
    conn = db(); cur = conn.cursor()
    if new_run:
        cur.execute(
            f"INSERT INTO {SCHEMA}.ug_driver_parse_runs (status, total_fetched, new_members, updated_members, source_group, alphabet_pos) "
            f"VALUES ('running', 0, 0, 0, '{esc(source_group)}', 0) RETURNING id"
        )
        run_id = cur.fetchone()[0]
        conn.commit(); cur.close(); conn.close()
        return run_id, 0, source_group
    # продолжение последнего running/partial
    cur.execute(
        f"SELECT id, COALESCE(alphabet_pos, 0), COALESCE(source_group, '{esc(TARGET_GROUP)}') FROM {SCHEMA}.ug_driver_parse_runs "
        f"WHERE status IN ('running','partial') ORDER BY id DESC LIMIT 1"
    )
    r = cur.fetchone()
    if not r:
        cur.execute(
            f"INSERT INTO {SCHEMA}.ug_driver_parse_runs (status, total_fetched, new_members, updated_members, source_group, alphabet_pos) "
            f"VALUES ('running', 0, 0, 0, '{esc(source_group)}', 0) RETURNING id"
        )
        run_id = cur.fetchone()[0]
        pos = 0
        sg = source_group
    else:
        run_id, pos, sg = r
    conn.commit(); cur.close(); conn.close()
    return run_id, pos, sg


def update_run_progress(run_id: int, pos: int, fetched: int, new_m: int, upd_m: int):
    conn = db(); cur = conn.cursor()
    cur.execute(
        f"UPDATE {SCHEMA}.ug_driver_parse_runs SET "
        f"total_fetched=total_fetched+{fetched}, "
        f"new_members=new_members+{new_m}, "
        f"updated_members=updated_members+{upd_m}, "
        f"alphabet_pos={int(pos)}, status='partial' WHERE id={run_id}"
    )
    conn.commit(); cur.close(); conn.close()


def finalize_run(run_id: int, ok: bool, err: str = None):
    conn = db(); cur = conn.cursor()
    status = 'success' if ok else 'failed'
    err_sql = 'NULL' if not err else "'" + esc(err) + "'"
    cur.execute(
        f"UPDATE {SCHEMA}.ug_driver_parse_runs SET "
        f"finished_at=NOW(), status='{status}', error={err_sql} WHERE id={run_id}"
    )
    conn.commit(); cur.close(); conn.close()


def upsert_user(u, source_group: str) -> int:
    """Записывает участника. Возвращает 1 если новый, 0 если обновление."""
    username = (u.username or '').replace("'", "''")
    first_name = (u.first_name or '').replace("'", "''")
    last_name = (u.last_name or '').replace("'", "''")
    is_bot = bool(getattr(u, 'bot', False))
    is_premium = bool(getattr(u, 'premium', False))
    phone = (getattr(u, 'phone', '') or '').replace("'", "''")
    raw = json.dumps({
        'id': u.id, 'username': u.username,
        'first_name': u.first_name, 'last_name': u.last_name,
        'bot': is_bot, 'premium': is_premium,
        'source': source_group,
    }).replace("'", "''")

    conn = db(); cur = conn.cursor()
    cur.execute(
        f"INSERT INTO {SCHEMA}.ug_driver_members "
        f"(user_id, username, first_name, last_name, is_bot, is_premium, phone, status, source_group, last_parsed_at, raw) "
        f"VALUES ({int(u.id)}, '{username}', '{first_name}', '{last_name}', "
        f"{is_bot}, {is_premium}, '{phone}', 'member', '{esc(source_group)}', NOW(), '{raw}'::jsonb) "
        f"ON CONFLICT (user_id) DO UPDATE SET "
        f"username=EXCLUDED.username, first_name=EXCLUDED.first_name, "
        f"last_name=EXCLUDED.last_name, is_bot=EXCLUDED.is_bot, "
        f"is_premium=EXCLUDED.is_premium, "
        f"phone=CASE WHEN EXCLUDED.phone <> '' THEN EXCLUDED.phone ELSE {SCHEMA}.ug_driver_members.phone END, "
        f"source_group=EXCLUDED.source_group, "
        f"last_parsed_at=NOW(), raw=EXCLUDED.raw "
        f"RETURNING (xmax = 0) AS inserted"
    )
    inserted = 1 if cur.fetchone()[0] else 0
    conn.commit(); cur.close(); conn.close()
    return inserted


async def run_parse_chunk(new_run: bool, group_input: str = '') -> dict:
    """Парсит чанк букв алфавита, ограничен по времени. Возвращает прогресс и нужно ли продолжать."""
    session_str = get_session2()
    if not session_str:
        return {'ok': False, 'error': 'not_logged_in: Залогинь второй Telegram-аккаунт'}

    api_id = int(os.environ['TG_API_ID'])
    api_hash = os.environ['TG_API_HASH']

    source_group = normalize_group(group_input) if new_run else (normalize_group(group_input) or TARGET_GROUP)
    run_id, start_pos, source_group = get_or_create_run(new_run, source_group)

    started = time.time()
    total_fetched = 0
    new_members = 0
    updated_members = 0
    seen_ids = set()
    error = None
    pos = start_pos

    client = TelegramClient(StringSession(session_str), api_id, api_hash)
    await client.connect()
    try:
        try:
            entity = await client.get_entity(source_group)
        except Exception as e:
            raise Exception(f'нет доступа к {source_group}: {e}')

        while pos < len(ALPHABET):
            if time.time() - started > TIME_LIMIT_SEC:
                break
            letter = ALPHABET[pos]
            offset = 0
            limit = 200
            while True:
                if time.time() - started > TIME_LIMIT_SEC:
                    break
                try:
                    participants = await client(GetParticipantsRequest(
                        channel=entity,
                        filter=ChannelParticipantsSearch(letter),
                        offset=offset, limit=limit, hash=0,
                    ))
                except Exception as e:
                    error = f'fetch_error letter={letter!r}: {str(e)[:200]}'
                    break
                users = participants.users
                if not users:
                    break
                for u in users:
                    if u.id in seen_ids:
                        continue
                    seen_ids.add(u.id)
                    total_fetched += 1
                    inserted = upsert_user(u, source_group)
                    if inserted:
                        new_members += 1
                    else:
                        updated_members += 1
                if len(users) < limit:
                    break
                offset += limit
            pos += 1
    except Exception as e:
        error = str(e)[:300]
    finally:
        try:
            await client.disconnect()
        except Exception:
            pass

    update_run_progress(run_id, pos, total_fetched, new_members, updated_members)

    finished = pos >= len(ALPHABET)
    if finished or error:
        finalize_run(run_id, ok=(not error), err=error)

    return {
        'ok': not error,
        'run_id': run_id,
        'source_group': source_group,
        'total_fetched': total_fetched,
        'new_members': new_members,
        'updated_members': updated_members,
        'pos': pos,
        'total_letters': len(ALPHABET),
        'finished': finished,
        'error': error,
    }


def handler(event: dict, context) -> dict:
    """Парсер участников @UG_DRIVER. POST ?action=parse — старт, ?action=parse_continue — продолжить."""
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    qs = event.get('queryStringParameters') or {}
    action = qs.get('action', '')
    headers = event.get('headers') or {}
    token = headers.get('X-Admin-Token') or headers.get('x-admin-token') or ''

    if method == 'GET':
        if not verify_token(token):
            return resp(401, {'error': 'unauthorized'})
        if action == 'list':
            limit = min(int(qs.get('limit', 50) or 50), 500)
            offset = int(qs.get('offset', 0) or 0)
            q = qs.get('q', '') or ''
            status_filter = qs.get('status', '') or ''
            group_filter = qs.get('group', '') or ''
            return resp(200, get_list(limit, offset, q, status_filter, group_filter))
        if action == 'groups':
            return resp(200, {'items': get_groups()})
        return resp(200, get_stats())

    if method == 'POST':
        if not verify_token(token):
            return resp(401, {'error': 'unauthorized'})
        if action in ('parse', 'parse_continue'):
            new_run = (action == 'parse')
            group_input = ''
            try:
                body = json.loads(event.get('body') or '{}')
                group_input = (body.get('group') or '').strip()
            except Exception:
                pass
            if not group_input:
                group_input = qs.get('group', '') or ''
            try:
                result = asyncio.run(run_parse_chunk(new_run, group_input))
                return resp(200, result)
            except Exception as e:
                return resp(500, {'ok': False, 'error': str(e)[:500]})
        return resp(400, {'error': 'unknown action'})

    return resp(405, {'error': 'method not allowed'})