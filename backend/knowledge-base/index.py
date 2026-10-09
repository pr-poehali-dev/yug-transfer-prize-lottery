"""
База знаний для раздела «Посты в канал».
GET — список статей. POST — создать. PUT — обновить. DELETE ?id= — удалить.
?entity=lists — то же для белых/чёрных списков водителей и диспетчеров.
"""
import os
import json
import hashlib
import psycopg2

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
}
SCHEMA = 't_p67171637_yug_transfer_prize_l'


def verify_token(token: str) -> bool:
    if not token:
        return False
    a = hashlib.sha256(f"{os.environ.get('ADMIN_LOGIN', '')}:{os.environ.get('ADMIN_PASSWORD', '')}:admin_secret_2026".encode()).hexdigest()
    pl = os.environ.get('POSTS_LOGIN', '')
    p = hashlib.sha256(f"{pl}:{os.environ.get('POSTS_PASSWORD', '')}:posts_secret_2026".encode()).hexdigest()
    return token == a or (bool(pl) and token == p)


def resp(code: int, data: dict) -> dict:
    return {'statusCode': code, 'headers': {**CORS, 'Content-Type': 'application/json'},
            'body': json.dumps(data, ensure_ascii=False, default=str)}


def esc(v) -> str:
    return str(v or '').replace("'", "''")


ROLES = ('driver', 'dispatcher')
LIST_TYPES = ('white', 'black')


def clean_phone(v) -> str:
    return ''.join(ch for ch in str(v or '') if ch.isdigit() or ch == '+')


def handle_lists(cur, conn, method: str, qs: dict, body: dict) -> dict:
    if method == 'GET':
        cur.execute(f"SELECT id, role, list_type, name, username, phone, note, created_at "
                    f"FROM {SCHEMA}.check_lists ORDER BY id DESC")
        items = [{'id': r[0], 'role': r[1], 'list_type': r[2], 'name': r[3], 'username': r[4],
                  'phone': r[5], 'note': r[6], 'created_at': r[7]} for r in cur.fetchall()]
        return resp(200, {'ok': True, 'items': items})

    if method in ('POST', 'PUT'):
        role, lt = body.get('role'), body.get('list_type')
        if role not in ROLES or lt not in LIST_TYPES:
            return resp(400, {'error': 'bad role or list_type'})
        username = esc(str(body.get('username') or '').strip().lstrip('@'))
        vals = (esc(body.get('name')), username, esc(clean_phone(body.get('phone'))), esc(body.get('note')))
        if method == 'POST':
            cur.execute(
                f"INSERT INTO {SCHEMA}.check_lists (role, list_type, name, username, phone, note) "
                f"VALUES ('{role}', '{lt}', '{vals[0]}', '{vals[1]}', '{vals[2]}', '{vals[3]}') RETURNING id")
            new_id = cur.fetchone()[0]
            conn.commit()
            return resp(200, {'ok': True, 'id': new_id})
        item_id = int(body.get('id') or 0)
        cur.execute(
            f"UPDATE {SCHEMA}.check_lists SET role='{role}', list_type='{lt}', name='{vals[0]}', "
            f"username='{vals[1]}', phone='{vals[2]}', note='{vals[3]}', updated_at=now() WHERE id={item_id}")
        conn.commit()
        return resp(200, {'ok': True})

    if method == 'DELETE':
        cur.execute(f"DELETE FROM {SCHEMA}.check_lists WHERE id={int(qs.get('id') or 0)}")
        conn.commit()
        return resp(200, {'ok': True})

    return resp(405, {'error': 'Method not allowed'})


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    headers = event.get('headers') or {}
    token = headers.get('X-Admin-Token') or headers.get('x-admin-token') or ''
    if not verify_token(token):
        return resp(401, {'error': 'Unauthorized'})

    method = event.get('httpMethod', 'GET')
    qs = event.get('queryStringParameters') or {}
    body = json.loads(event.get('body') or '{}') if method in ('POST', 'PUT') else {}

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        if qs.get('entity') == 'lists':
            return handle_lists(cur, conn, method, qs, body)

        if method == 'GET':
            cur.execute(f"SELECT id, title, category, content, created_at, updated_at FROM {SCHEMA}.knowledge_base ORDER BY category, title, id")
            items = [{'id': r[0], 'title': r[1], 'category': r[2], 'content': r[3],
                      'created_at': r[4], 'updated_at': r[5]} for r in cur.fetchall()]
            return resp(200, {'ok': True, 'items': items})

        if method == 'POST':
            cur.execute(
                f"INSERT INTO {SCHEMA}.knowledge_base (title, category, content) "
                f"VALUES ('{esc(body.get('title'))}', '{esc(body.get('category'))}', '{esc(body.get('content'))}') RETURNING id")
            new_id = cur.fetchone()[0]
            conn.commit()
            return resp(200, {'ok': True, 'id': new_id})

        if method == 'PUT':
            item_id = int(body.get('id') or 0)
            cur.execute(
                f"UPDATE {SCHEMA}.knowledge_base SET title='{esc(body.get('title'))}', "
                f"category='{esc(body.get('category'))}', content='{esc(body.get('content'))}', "
                f"updated_at=now() WHERE id={item_id}")
            conn.commit()
            return resp(200, {'ok': True})

        if method == 'DELETE':
            item_id = int(qs.get('id') or 0)
            cur.execute(f"DELETE FROM {SCHEMA}.knowledge_base WHERE id={item_id}")
            conn.commit()
            return resp(200, {'ok': True})

        return resp(405, {'error': 'Method not allowed'})
    finally:
        cur.close()
        conn.close()
