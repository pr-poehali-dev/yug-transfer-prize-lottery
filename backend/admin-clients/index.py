"""
База клиентов для админ-панели: список пользователей с полными данными, платежами и участиями.
DELETE — удаление клиента из системы и всех его участий.
PATCH — изменение данных клиента (имя, телефон, пароль).
"""
import os
import json
import hashlib
import psycopg2

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, DELETE, PATCH, OPTIONS',
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

    method = event.get('httpMethod', 'GET')

    # Удаление клиента
    if method == 'DELETE':
        try:
            body = json.loads(event.get('body') or '{}')
        except Exception:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Invalid JSON'})}

        user_id = body.get('user_id')
        if not user_id:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'user_id обязателен'})}

        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()

        # Считаем участия которые нужно отнять у розыгрышей
        cur.execute(f"SELECT raffle_id FROM {SCHEMA}.entries WHERE user_id = %s", (user_id,))
        raffle_ids = [r[0] for r in cur.fetchall()]

        # Уменьшаем счётчик участников в розыгрышах
        for rid in raffle_ids:
            cur.execute(
                f"UPDATE {SCHEMA}.raffles SET participants = GREATEST(0, participants - 1) WHERE id = %s",
                (rid,)
            )

        # Удаляем все записи пользователя
        cur.execute(f"DELETE FROM {SCHEMA}.entries WHERE user_id = %s", (user_id,))
        cur.execute(f"DELETE FROM {SCHEMA}.transactions WHERE user_id = %s", (user_id,))
        cur.execute(f"DELETE FROM {SCHEMA}.push_subscriptions WHERE user_id = %s", (user_id,))
        cur.execute(f"DELETE FROM {SCHEMA}.users WHERE id = %s", (user_id,))

        conn.commit()
        cur.close()
        conn.close()

        print(f"[ADMIN] deleted user {user_id}, raffle entries: {raffle_ids}")
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

    # PATCH — редактирование клиента (имя, телефон, пароль)
    if method == 'PATCH':
        try:
            body = json.loads(event.get('body') or '{}')
        except Exception:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Invalid JSON'})}

        user_id = body.get('user_id')
        if not user_id:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'user_id обязателен'})}

        fields = []
        values = []

        if 'first_name' in body:
            fields.append('first_name = %s')
            values.append(body['first_name'])
        if 'last_name' in body:
            fields.append('last_name = %s')
            values.append(body['last_name'])
        if 'phone' in body:
            phone = body['phone'].replace('+', '').replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
            fields.append('phone = %s')
            values.append(phone)
        if 'password' in body and body['password']:
            pw_hash = hashlib.sha256(body['password'].encode()).hexdigest()
            fields.append('password_hash = %s')
            values.append(pw_hash)
        if 'balance' in body:
            fields.append('balance = %s')
            values.append(int(body['balance']))

        if not fields:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Нет полей для обновления'})}

        values.append(user_id)
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(f"UPDATE {SCHEMA}.users SET {', '.join(fields)} WHERE id = %s", values)
        conn.commit()
        cur.close()
        conn.close()
        print(f"[ADMIN] updated user {user_id}: {[f.split(' =')[0] for f in fields]}")
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

    # GET /?action=entries&user_id=X — участия конкретного клиента
    qs = event.get('queryStringParameters') or {}
    if qs.get('action') == 'entries':
        user_id = qs.get('user_id')
        if not user_id:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'user_id обязателен'})}
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(f"""
            SELECT e.id, r.title, r.prize, r.prize_icon, r.status, r.winner,
                   e.tickets, e.amount, e.created_at, r.photo_url, r.gradient
            FROM {SCHEMA}.entries e
            JOIN {SCHEMA}.raffles r ON r.id = e.raffle_id
            WHERE e.user_id = %s
            ORDER BY e.created_at DESC
        """, (user_id,))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        entries = [{
            'id': r[0], 'raffle_title': r[1], 'raffle_prize': r[2],
            'raffle_icon': r[3], 'raffle_status': r[4], 'winner': r[5],
            'tickets': r[6], 'amount': r[7],
            'created_at': r[8].isoformat() if r[8] else None,
            'raffle_photo': r[9], 'raffle_gradient': r[10],
        } for r in rows]
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'entries': entries})}

    # GET — список клиентов
    params = qs
    page = int(params.get('page', 1))
    limit = int(params.get('limit', 50))
    search = params.get('search', '').strip()
    offset = (page - 1) * limit

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()

    where = ""
    args = []
    if search:
        where = "WHERE u.first_name ILIKE %s OR u.last_name ILIKE %s OR u.username ILIKE %s OR CAST(u.telegram_id AS TEXT) LIKE %s OR u.phone LIKE %s"
        args = [f'%{search}%', f'%{search}%', f'%{search}%', f'%{search}%', f'%{search.replace("+", "").replace(" ", "").replace("-", "")}%']

    count_sql = f"SELECT COUNT(*) FROM {SCHEMA}.users u {where}"
    cur.execute(count_sql, args)
    total = cur.fetchone()[0]

    sql = f"""
        SELECT
            u.id, u.telegram_id, u.first_name, u.last_name, u.username,
            u.photo_url, u.balance, u.created_at, u.phone,
            COALESCE(SUM(CASE WHEN t.type='entry' AND t.status='completed' THEN t.amount ELSE 0 END), 0) as total_paid,
            COUNT(DISTINCT t.id) FILTER (WHERE t.status='completed') as payments_count,
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
            'phone': r[8] or '',
            'total_paid': int(r[9]),
            'payments_count': int(r[10]),
            'entries_count': int(r[11]),
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