"""Управление списком кандидатов для приглашения в @UG_DRIVE.
GET                       — статистика и последние записи
POST ?action=import       — импорт списка (массив строк username/phone)
POST ?action=clear        — очистить весь список
POST ?action=delete       — удалить одну запись по id
"""
import os
import json
import hashlib
import re
import psycopg2

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


def normalize_username(s: str) -> str:
    s = (s or '').strip()
    if not s:
        return ''
    s = s.lstrip('@').strip()
    s = re.sub(r'^https?://(t\.me|telegram\.me)/', '', s, flags=re.I)
    s = s.split('?')[0].split('/')[0].strip()
    return s if re.match(r'^[a-zA-Z][a-zA-Z0-9_]{3,31}$', s) else ''


def normalize_phone(s: str) -> str:
    s = (s or '').strip()
    digits = re.sub(r'\D', '', s)
    if not digits:
        return ''
    if len(digits) == 11 and digits.startswith('8'):
        digits = '7' + digits[1:]
    if len(digits) >= 10:
        return '+' + digits
    return ''


def get_stats() -> dict:
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        SELECT
            COUNT(*) FILTER (WHERE TRUE) AS total,
            COUNT(*) FILTER (WHERE status='pending') AS pending,
            COUNT(*) FILTER (WHERE status='added') AS added,
            COUNT(*) FILTER (WHERE status='privacy') AS privacy,
            COUNT(*) FILTER (WHERE status='invited_link') AS invited_link,
            COUNT(*) FILTER (WHERE status='failed') AS failed
        FROM {SCHEMA}.invite_targets
    """)
    row = cur.fetchone()
    cur.execute(f"""
        SELECT id, username, phone, first_name, status, added_at, error, source, created_at
        FROM {SCHEMA}.invite_targets
        ORDER BY id DESC LIMIT 50
    """)
    items = []
    for r in cur.fetchall():
        items.append({
            'id': r[0], 'username': r[1], 'phone': r[2], 'first_name': r[3],
            'status': r[4], 'added_at': str(r[5]) if r[5] else None,
            'error': r[6], 'source': r[7], 'created_at': str(r[8]) if r[8] else None,
        })
    cur.close(); conn.close()
    return {
        'stats': {
            'total': row[0], 'pending': row[1], 'added': row[2],
            'privacy': row[3], 'invited_link': row[4], 'failed': row[5],
        },
        'recent': items,
    }


def import_list(items: list, source: str) -> dict:
    inserted = 0
    skipped_dup = 0
    skipped_bad = 0
    conn = db(); cur = conn.cursor()
    for raw in items:
        if isinstance(raw, dict):
            uname = normalize_username(raw.get('username', ''))
            phone = normalize_phone(raw.get('phone', ''))
            fname = (raw.get('first_name') or '').strip()
        else:
            text = str(raw).strip()
            uname = normalize_username(text)
            phone = '' if uname else normalize_phone(text)
            fname = ''
        if not uname and not phone:
            skipped_bad += 1
            continue
        try:
            if uname:
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.invite_targets (username, first_name, source, status)
                    VALUES ('{esc(uname)}', '{esc(fname)}', '{esc(source)}', 'pending')
                    ON CONFLICT (LOWER(username)) WHERE username IS NOT NULL DO NOTHING
                """)
            else:
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.invite_targets (phone, first_name, source, status)
                    VALUES ('{esc(phone)}', '{esc(fname)}', '{esc(source)}', 'pending')
                    ON CONFLICT (phone) WHERE phone IS NOT NULL DO NOTHING
                """)
            if cur.rowcount > 0:
                inserted += 1
            else:
                skipped_dup += 1
        except Exception as e:
            skipped_bad += 1
            print(f"[import] err for {raw}: {e}")
    conn.commit(); cur.close(); conn.close()
    return {'ok': True, 'inserted': inserted, 'skipped_dup': skipped_dup, 'skipped_bad': skipped_bad}


def clear_all() -> dict:
    conn = db(); cur = conn.cursor()
    cur.execute(f"DELETE FROM {SCHEMA}.invite_targets")
    deleted = cur.rowcount
    conn.commit(); cur.close(); conn.close()
    return {'ok': True, 'deleted': deleted}


def delete_one(target_id: int) -> dict:
    conn = db(); cur = conn.cursor()
    cur.execute(f"DELETE FROM {SCHEMA}.invite_targets WHERE id={target_id}")
    conn.commit(); cur.close(); conn.close()
    return {'ok': True}


def handler(event: dict, context) -> dict:
    """Управление списком кандидатов на приглашение в группу."""
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
        return resp(200, get_stats())

    body = json.loads(event.get('body') or '{}')

    if action == 'import':
        items = body.get('items') or []
        source = body.get('source', 'csv')
        if not isinstance(items, list):
            return resp(400, {'error': 'items must be array'})
        result = import_list(items, source)
        result.update(get_stats())
        return resp(200, result)

    if action == 'clear':
        result = clear_all()
        result.update(get_stats())
        return resp(200, result)

    if action == 'delete':
        target_id = int(body.get('id', 0))
        if not target_id:
            return resp(400, {'error': 'id required'})
        result = delete_one(target_id)
        result.update(get_stats())
        return resp(200, result)

    return resp(400, {'error': 'unknown action'})
