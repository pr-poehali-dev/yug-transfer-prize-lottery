"""Парсер участников группы @UG_DRIVER в БД.

GET                — статистика (сколько участников в БД, последний парсинг)
GET ?action=list   — список участников (с пагинацией: ?limit=50&offset=0&q=поиск)
POST ?action=parse — запустить парсинг группы (нужен токен админа)
"""
import os
import json
import hashlib
import asyncio
import psycopg2

from telethon import TelegramClient
from telethon.sessions import StringSession

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
}
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')
TARGET_GROUP = '@UG_DRIVER'


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
    return {'total': total, 'with_username': with_username, 'bots': bots, 'last_run': last_run}


def get_list(limit: int, offset: int, q: str) -> dict:
    where = "WHERE 1=1"
    if q:
        qe = esc(q)
        where += f" AND (username ILIKE '%{qe}%' OR first_name ILIKE '%{qe}%' OR last_name ILIKE '%{qe}%' OR CAST(user_id AS TEXT) ILIKE '%{qe}%')"
    conn = db(); cur = conn.cursor()
    cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.ug_driver_members {where}")
    total = cur.fetchone()[0]
    cur.execute(
        f"SELECT user_id, username, first_name, last_name, is_bot, is_premium, status, last_parsed_at "
        f"FROM {SCHEMA}.ug_driver_members {where} "
        f"ORDER BY last_parsed_at DESC LIMIT {int(limit)} OFFSET {int(offset)}"
    )
    items = []
    for r in cur.fetchall():
        items.append({
            'user_id': r[0], 'username': r[1] or '', 'first_name': r[2] or '',
            'last_name': r[3] or '', 'is_bot': r[4], 'is_premium': r[5],
            'status': r[6], 'last_parsed_at': r[7],
        })
    cur.close(); conn.close()
    return {'total': total, 'items': items}


async def run_parse() -> dict:
    """Полный парсинг участников @UG_DRIVER."""
    session_str = get_session2()
    if not session_str:
        return {'ok': False, 'error': 'not_logged_in: Залогинь второй Telegram-аккаунт'}

    api_id = int(os.environ['TG_API_ID'])
    api_hash = os.environ['TG_API_HASH']

    conn = db(); cur = conn.cursor()
    cur.execute(f"INSERT INTO {SCHEMA}.ug_driver_parse_runs (status) VALUES ('running') RETURNING id")
    run_id = cur.fetchone()[0]
    conn.commit(); cur.close(); conn.close()

    total_fetched = 0
    new_members = 0
    updated_members = 0
    error = None

    client = TelegramClient(StringSession(session_str), api_id, api_hash)
    await client.connect()
    try:
        try:
            entity = await client.get_entity(TARGET_GROUP)
        except Exception as e:
            raise Exception(f'нет доступа к {TARGET_GROUP}: {e}')

        # Telegram отдаёт макс ~200 через пустой поиск.
        # Используем iter_participants(aggressive=True) — Telethon внутри
        # перебирает алфавит и собирает всех участников до ~10000.
        seen_ids = set()
        batch = []
        BATCH_SIZE = 50

        async def flush(rows):
            nonlocal new_members, updated_members
            if not rows:
                return
            conn_b = db(); cur_b = conn_b.cursor()
            for vals in rows:
                cur_b.execute(vals)
                inserted = cur_b.fetchone()[0]
                if inserted:
                    new_members += 1
                else:
                    updated_members += 1
            conn_b.commit(); cur_b.close(); conn_b.close()

        try:
            async for u in client.iter_participants(entity, aggressive=True):
                if u.id in seen_ids:
                    continue
                seen_ids.add(u.id)
                total_fetched += 1

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
                }).replace("'", "''")

                sql = (
                    f"INSERT INTO {SCHEMA}.ug_driver_members "
                    f"(user_id, username, first_name, last_name, is_bot, is_premium, phone, status, last_parsed_at, raw) "
                    f"VALUES ({int(u.id)}, '{username}', '{first_name}', '{last_name}', "
                    f"{is_bot}, {is_premium}, '{phone}', 'member', NOW(), '{raw}'::jsonb) "
                    f"ON CONFLICT (user_id) DO UPDATE SET "
                    f"username=EXCLUDED.username, first_name=EXCLUDED.first_name, "
                    f"last_name=EXCLUDED.last_name, is_bot=EXCLUDED.is_bot, "
                    f"is_premium=EXCLUDED.is_premium, "
                    f"phone=CASE WHEN EXCLUDED.phone <> '' THEN EXCLUDED.phone ELSE {SCHEMA}.ug_driver_members.phone END, "
                    f"last_parsed_at=NOW(), raw=EXCLUDED.raw "
                    f"RETURNING (xmax = 0) AS inserted"
                )
                batch.append(sql)
                if len(batch) >= BATCH_SIZE:
                    await flush(batch)
                    batch = []
            await flush(batch)
        except Exception as e:
            error = f'iter_error after {total_fetched}: {str(e)[:300]}'

    except Exception as e:
        error = str(e)[:500]
    finally:
        try:
            await client.disconnect()
        except Exception:
            pass

    status = 'failed' if error else 'success'
    error_sql = 'NULL' if not error else "'" + esc(error) + "'"
    conn = db(); cur = conn.cursor()
    cur.execute(
        f"UPDATE {SCHEMA}.ug_driver_parse_runs SET "
        f"finished_at=NOW(), status='{status}', "
        f"total_fetched={total_fetched}, new_members={new_members}, "
        f"updated_members={updated_members}, error={error_sql} "
        f"WHERE id={run_id}"
    )
    conn.commit(); cur.close(); conn.close()

    return {
        'ok': not error, 'run_id': run_id,
        'total_fetched': total_fetched,
        'new_members': new_members, 'updated_members': updated_members,
        'error': error,
    }


def handler(event: dict, context) -> dict:
    """Парсер участников @UG_DRIVER. GET — статистика/список, POST ?action=parse — запустить парсинг."""
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
            return resp(200, get_list(limit, offset, q))
        return resp(200, get_stats())

    if method == 'POST':
        if not verify_token(token):
            return resp(401, {'error': 'unauthorized'})
        if action == 'parse':
            try:
                result = asyncio.run(run_parse())
                return resp(200, result)
            except Exception as e:
                return resp(500, {'ok': False, 'error': str(e)[:500]})
        return resp(400, {'error': 'unknown action'})

    return resp(405, {'error': 'method not allowed'})