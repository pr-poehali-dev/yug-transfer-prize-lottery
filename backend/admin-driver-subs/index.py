"""
Business: Возвращает админу список подписок водителей со статусами и суммой выручки.
Args: event с httpMethod, headers (X-Admin-Token)
Returns: {ok, subs: [...], total_active, total_revenue}
"""
import json
import os
import psycopg2

DB_URL = os.environ.get('DATABASE_URL', '')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', '')


def handler(event: dict, context) -> dict:
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
        'Content-Type': 'application/json',
    }
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': headers, 'body': ''}

    h = event.get('headers') or {}
    token = h.get('X-Admin-Token') or h.get('x-admin-token') or ''
    if not ADMIN_PASSWORD or token != ADMIN_PASSWORD:
        return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'ok': False, 'error': 'unauthorized'})}

    conn = psycopg2.connect(DB_URL)
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, telegram_id, username, first_name, plan, amount_rub,
                   started_at, expires_at, status
            FROM driver_subscriptions
            ORDER BY expires_at DESC
            LIMIT 500
        """)
        subs = []
        active = 0
        revenue = 0
        for row in cur.fetchall():
            sub = {
                'id': row[0],
                'telegram_id': row[1],
                'username': row[2] or '',
                'first_name': row[3] or '',
                'plan': row[4],
                'amount_rub': row[5],
                'started_at': row[6].isoformat() if row[6] else None,
                'expires_at': row[7].isoformat() if row[7] else None,
                'status': row[8],
            }
            subs.append(sub)
            if sub['status'] == 'active':
                active += 1
            revenue += sub['amount_rub']

        return {'statusCode': 200, 'headers': headers, 'body': json.dumps({
            'ok': True, 'subs': subs, 'total_active': active, 'total_revenue': revenue,
        })}
    finally:
        conn.close()
