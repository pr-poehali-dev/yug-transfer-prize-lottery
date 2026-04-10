"""
База клиентов для админ-панели: список пользователей с полными данными, платежами и участиями.
"""
import os
import json
import hashlib
import psycopg2

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
}

SCHEMA = 't_p67171637_yug_transfer_prize_l'


def verify_token(token: str) -> bool:
    admin_login = os.environ.get('ADMIN_LOGIN', '')
    admin_password = os.environ.get('ADMIN_PASSWORD', '')
    token_base = f"{admin_login}:{admin_password}:admin_secret_2026"
    return token == hashlib.sha256(token_base.encode()).hexdigest()


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    token = event.get('headers', {}).get('X-Admin-Token', '')
    if not verify_token(token):
        return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Unauthorized'})}

    params = event.get('queryStringParameters') or {}
    page = int(params.get('page', 1))
    limit = int(params.get('limit', 50))
    search = params.get('search', '').strip()
    offset = (page - 1) * limit

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()

    where = ""
    args = []
    if search:
        where = "WHERE u.first_name ILIKE %s OR u.last_name ILIKE %s OR u.username ILIKE %s OR CAST(u.telegram_id AS TEXT) LIKE %s"
        args = [f'%{search}%', f'%{search}%', f'%{search}%', f'%{search}%']

    count_sql = f"SELECT COUNT(*) FROM {SCHEMA}.users u {where}"
    cur.execute(count_sql, args)
    total = cur.fetchone()[0]

    sql = f"""
        SELECT
            u.id, u.telegram_id, u.first_name, u.last_name, u.username,
            u.photo_url, u.balance, u.created_at,
            COALESCE(SUM(CASE WHEN t.type='deposit' AND t.status='completed' THEN t.amount ELSE 0 END), 0) as total_paid,
            COUNT(DISTINCT t.id) FILTER (WHERE t.type='deposit' AND t.status='completed') as payments_count,
            COUNT(DISTINCT e.id) as entries_count
        FROM {SCHEMA}.users u
        LEFT JOIN {SCHEMA}.transactions t ON t.user_id = u.id
        LEFT JOIN {SCHEMA}.entries e ON e.user_id = u.id
        {where}
        GROUP BY u.id
        ORDER BY u.created_at DESC
        LIMIT %s OFFSET %s
    """
    cur.execute(sql, args + [limit, offset])
    rows = cur.fetchall()

    clients = []
    for r in rows:
        clients.append({
            'id': r[0],
            'telegram_id': r[1],
            'first_name': r[2] or '',
            'last_name': r[3] or '',
            'username': r[4] or '',
            'photo_url': r[5] or '',
            'balance': r[6],
            'created_at': str(r[7]) if r[7] else '',
            'total_paid': int(r[8]),
            'payments_count': int(r[9]),
            'entries_count': int(r[10]),
        })

    cur.close()
    conn.close()

    return {
        'statusCode': 200,
        'headers': CORS,
        'body': json.dumps({
            'ok': True,
            'clients': clients,
            'total': total,
            'page': page,
            'pages': (total + limit - 1) // limit if total > 0 else 1,
        })
    }
