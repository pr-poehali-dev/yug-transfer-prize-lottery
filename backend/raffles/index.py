"""
CRUD для розыгрышей. GET — список, POST — создать, PUT — обновить, DELETE — удалить.
Изменение данных требует заголовок X-Admin-Token.
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


def get_schema():
    return os.environ.get('MAIN_DB_SCHEMA', 'public')


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def get_token():
    login = os.environ.get('ADMIN_LOGIN', '')
    password = os.environ.get('ADMIN_PASSWORD', '')
    return hashlib.sha256(f"{login}:{password}:admin_secret_2026".encode()).hexdigest()


def row_to_dict(row):
    return {
        'id': row[0],
        'title': row[1],
        'prize': row[2],
        'prize_icon': row[3],
        'end_date': row[4].isoformat() if row[4] else None,
        'participants': row[5],
        'min_amount': row[6],
        'status': row[7],
        'gradient': row[8],
        'winner': row[9],
    }


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    schema = get_schema()

    # GET — публичный список
    if method == 'GET':
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"SELECT id, title, prize, prize_icon, end_date, participants, min_amount, status, gradient, winner FROM {schema}.raffles ORDER BY created_at DESC")
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'raffles': [row_to_dict(r) for r in rows]})}

    # Для POST/PUT/DELETE — проверяем токен
    token = event.get('headers', {}).get('X-Admin-Token', '')
    if token != get_token():
        return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Unauthorized'})}

    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Invalid JSON'})}

    conn = get_conn()
    cur = conn.cursor()

    if method == 'POST':
        cur.execute(
            f"""INSERT INTO {schema}.raffles (title, prize, prize_icon, end_date, participants, min_amount, status, gradient, winner)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, title, prize, prize_icon, end_date, participants, min_amount, status, gradient, winner""",
            (body['title'], body['prize'], body.get('prize_icon', 'Gift'),
             body['end_date'], body.get('participants', 0), body['min_amount'],
             body.get('status', 'active'), body.get('gradient', 'from-purple-600 via-pink-500 to-orange-400'),
             body.get('winner'))
        )
        row = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'raffle': row_to_dict(row)})}

    if method == 'PUT':
        rid = body.get('id')
        cur.execute(
            f"""UPDATE {schema}.raffles SET title=%s, prize=%s, prize_icon=%s, end_date=%s,
                participants=%s, min_amount=%s, status=%s, gradient=%s, winner=%s
                WHERE id=%s
                RETURNING id, title, prize, prize_icon, end_date, participants, min_amount, status, gradient, winner""",
            (body['title'], body['prize'], body.get('prize_icon', 'Gift'),
             body['end_date'], body.get('participants', 0), body['min_amount'],
             body.get('status', 'active'), body.get('gradient', 'from-purple-600 via-pink-500 to-orange-400'),
             body.get('winner'), rid)
        )
        row = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        if not row:
            return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Not found'})}
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'raffle': row_to_dict(row)})}

    if method == 'DELETE':
        rid = body.get('id')
        cur.execute(f"DELETE FROM {schema}.raffles WHERE id=%s", (rid,))
        conn.commit()
        cur.close()
        conn.close()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

    return {'statusCode': 405, 'headers': CORS, 'body': json.dumps({'error': 'Method not allowed'})}
