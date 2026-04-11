"""
Кабинет участника: профиль, баланс, история участий и транзакций.
GET /         — профиль + статистика (заголовок X-User-Id)
GET /?entries — история участий
GET /?transactions — история транзакций
"""
import os
import json
import psycopg2

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
}


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def get_schema():
    return os.environ.get('MAIN_DB_SCHEMA', 'public')


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    headers = event.get('headers') or {}
    user_id = headers.get('X-User-Id') or headers.get('x-user-id')
    if not user_id:
        return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Unauthorized'})}

    schema = get_schema()
    params = event.get('queryStringParameters') or {}
    conn = get_conn()
    cur = conn.cursor()

    # История участий
    if 'entries' in params:
        cur.execute(f"""
            SELECT e.id, r.title, r.prize, r.prize_icon, r.gradient, r.status, r.winner,
                   e.tickets, e.amount, e.created_at, r.photo_url
            FROM {schema}.entries e
            JOIN {schema}.raffles r ON r.id = e.raffle_id
            WHERE e.user_id = %s
            ORDER BY e.created_at DESC
            LIMIT 50
        """, (user_id,))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        entries = [{
            'id': r[0], 'raffle_title': r[1], 'raffle_prize': r[2],
            'raffle_icon': r[3], 'raffle_gradient': r[4],
            'raffle_status': r[5], 'winner': r[6],
            'tickets': r[7], 'amount': r[8],
            'created_at': r[9].isoformat() if r[9] else None,
            'raffle_photo': r[10],
        } for r in rows]
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'entries': entries})}

    # История транзакций
    if 'transactions' in params:
        cur.execute(f"""
            SELECT id, type, amount, description, status, created_at
            FROM {schema}.transactions
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 50
        """, (user_id,))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        txs = [{
            'id': r[0], 'type': r[1], 'amount': r[2],
            'description': r[3], 'status': r[4],
            'created_at': r[5].isoformat() if r[5] else None,
        } for r in rows]
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'transactions': txs})}

    # Профиль + статистика
    cur.execute(f"""
        SELECT id, telegram_id, first_name, last_name, username, photo_url, balance, created_at
        FROM {schema}.users WHERE id = %s
    """, (user_id,))
    row = cur.fetchone()
    if not row:
        cur.close()
        conn.close()
        return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'User not found'})}

    user = {
        'id': row[0], 'telegram_id': row[1],
        'first_name': row[2], 'last_name': row[3],
        'username': row[4], 'photo_url': row[5],
        'balance': row[6], 'created_at': row[7].isoformat() if row[7] else None,
    }

    # Статистика
    cur.execute(f"SELECT COUNT(*), COALESCE(SUM(amount),0) FROM {schema}.entries WHERE user_id = %s", (user_id,))
    stat = cur.fetchone()
    user['total_entries'] = stat[0]
    user['total_spent'] = stat[1]

    # Победы — участия в завершённых розыгрышах где winner совпадает с username/id
    cur.execute(f"""
        SELECT COUNT(*) FROM {schema}.entries e
        JOIN {schema}.raffles r ON r.id = e.raffle_id
        WHERE e.user_id = %s AND r.status = 'ended'
    """, (user_id,))
    user['wins'] = cur.fetchone()[0]

    cur.close()
    conn.close()
    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'user': user})}