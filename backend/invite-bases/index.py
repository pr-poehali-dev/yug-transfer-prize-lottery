"""Базы контактов для приглашений в Telegram-группу.
GET                        — список баз со статистикой + активная база
POST ?action=create        — создать базу из текстового файла (список username)
POST ?action=activate      — выбрать активную базу для инвайта
POST ?action=rename        — переименовать базу
POST ?action=delete        — удалить базу вместе с контактами
POST ?action=reset_status  — сбросить статусы базы в pending
"""
import os
import re
import json
import base64
import hashlib
import psycopg2

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
}
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')


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


def esc(s) -> str:
    return str(s or '').replace("'", "''")


def resp(status: int, body: dict) -> dict:
    return {'statusCode': status, 'headers': CORS, 'body': json.dumps(body, default=str)}


def db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def get_active_base() -> int:
    conn = db(); cur = conn.cursor()
    cur.execute(f"SELECT value FROM {SCHEMA}.app_settings WHERE key='invite_active_base'")
    r = cur.fetchone(); cur.close(); conn.close()
    try:
        return int(r[0]) if r else 0
    except Exception:
        return 0


def set_active_base(base_id: int):
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        INSERT INTO {SCHEMA}.app_settings (key, value, updated_at)
        VALUES ('invite_active_base', '{base_id}', NOW())
        ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()
    """)
    conn.commit(); cur.close(); conn.close()


def list_bases() -> list:
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        SELECT b.id, b.name, b.note, b.created_at,
               COUNT(t.id),
               COUNT(t.id) FILTER (WHERE t.status='pending'),
               COUNT(t.id) FILTER (WHERE t.status='added'),
               COUNT(t.id) FILTER (WHERE t.status='failed'),
               COUNT(t.id) FILTER (WHERE t.status IN ('no_username','bad_username'))
        FROM {SCHEMA}.invite_bases b
        LEFT JOIN {SCHEMA}.invite_targets t ON t.base_id = b.id
        GROUP BY b.id, b.name, b.note, b.created_at
        ORDER BY b.id ASC
    """)
    rows = cur.fetchall(); cur.close(); conn.close()
    return [{
        'id': r[0], 'name': r[1], 'note': r[2] or '', 'created_at': str(r[3]),
        'total': r[4], 'pending': r[5], 'added': r[6], 'failed': r[7], 'skipped': r[8],
    } for r in rows]


USERNAME_RE = re.compile(r'^[A-Za-z][A-Za-z0-9_]{3,31}$')


def parse_contacts(text: str) -> tuple:
    """Возвращает (валидные username, кол-во отброшенных строк)."""
    found, bad = [], 0
    seen = set()
    for raw in re.split(r'[\s,;]+', text or ''):
        s = raw.strip()
        if not s:
            continue
        m = re.search(r'(?:t\.me/|telegram\.me/)([A-Za-z][A-Za-z0-9_]{3,31})', s)
        u = m.group(1) if m else s.lstrip('@')
        if USERNAME_RE.match(u):
            k = u.lower()
            if k not in seen:
                seen.add(k)
                found.append(u)
        else:
            bad += 1
    return found, bad


def create_base(name: str, note: str, text: str) -> dict:
    usernames, bad = parse_contacts(text)
    if not usernames:
        return {'ok': False, 'error': 'В файле не найдено ни одного username'}

    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        INSERT INTO {SCHEMA}.invite_bases (name, note) VALUES ('{esc(name)}', '{esc(note)}') RETURNING id
    """)
    base_id = cur.fetchone()[0]

    imported = 0
    chunk = 1000
    for i in range(0, len(usernames), chunk):
        part = usernames[i:i + chunk]
        values = ','.join(
            f"('{esc(u)}', 'base:{base_id}', 'pending', {base_id})" for u in part
        )
        cur.execute(f"""
            INSERT INTO {SCHEMA}.invite_targets (username, source, status, base_id)
            VALUES {values}
            ON CONFLICT DO NOTHING
        """)
        imported += cur.rowcount
    conn.commit(); cur.close(); conn.close()
    return {'ok': True, 'base_id': base_id, 'imported': imported, 'skipped': bad,
            'duplicates': len(usernames) - imported}


def delete_base(base_id: int):
    conn = db(); cur = conn.cursor()
    cur.execute(f"DELETE FROM {SCHEMA}.invite_targets WHERE base_id={base_id}")
    cur.execute(f"DELETE FROM {SCHEMA}.invite_bases WHERE id={base_id}")
    conn.commit(); cur.close(); conn.close()
    if get_active_base() == base_id:
        set_active_base(0)


def rename_base(base_id: int, name: str):
    conn = db(); cur = conn.cursor()
    cur.execute(f"UPDATE {SCHEMA}.invite_bases SET name='{esc(name)}' WHERE id={base_id}")
    conn.commit(); cur.close(); conn.close()


def reset_status(base_id: int) -> int:
    conn = db(); cur = conn.cursor()
    cur.execute(f"""
        UPDATE {SCHEMA}.invite_targets
        SET status='pending', error=NULL
        WHERE base_id={base_id} AND status IN ('failed','bad_username')
    """)
    n = cur.rowcount
    conn.commit(); cur.close(); conn.close()
    return n


def handler(event: dict, context) -> dict:
    """Управление базами контактов для приглашений в Telegram-группу."""
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
        return resp(200, {'ok': True, 'bases': list_bases(), 'active_base': get_active_base()})

    body = json.loads(event.get('body') or '{}')

    if action == 'create':
        name = (body.get('name') or '').strip() or 'Новая база'
        note = (body.get('note') or '').strip()
        text = body.get('content') or ''
        if body.get('content_base64'):
            text = base64.b64decode(body['content_base64']).decode('utf-8', 'ignore')
        try:
            result = create_base(name, note, text)
        except Exception as e:
            return resp(400, {'ok': False, 'error': f'Ошибка загрузки: {str(e)[:300]}'})
        if not result.get('ok'):
            return resp(400, result)
        if not get_active_base():
            set_active_base(result['base_id'])
        return resp(200, {**result, 'bases': list_bases(), 'active_base': get_active_base()})

    base_id = int(body.get('id', 0) or 0)
    if not base_id:
        return resp(400, {'error': 'id required'})

    if action == 'activate':
        set_active_base(base_id)
    elif action == 'rename':
        rename_base(base_id, (body.get('name') or '').strip())
    elif action == 'delete':
        delete_base(base_id)
    elif action == 'reset_status':
        n = reset_status(base_id)
        return resp(200, {'ok': True, 'reset': n, 'bases': list_bases(), 'active_base': get_active_base()})
    else:
        return resp(400, {'error': 'unknown action'})

    return resp(200, {'ok': True, 'bases': list_bases(), 'active_base': get_active_base()})