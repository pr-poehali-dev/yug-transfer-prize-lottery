"""
Расширенная статистика для админ-панели: пользователи, платежи, записи на розыгрыши.
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

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()

    cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users")
    total_users = cur.fetchone()[0]

    cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE created_at >= now() - interval '7 days'")
    new_users_week = cur.fetchone()[0]

    cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE created_at >= now() - interval '30 days'")
    new_users_month = cur.fetchone()[0]

    cur.execute(f"SELECT COALESCE(SUM(amount), 0) FROM {SCHEMA}.transactions WHERE type='entry' AND status='completed'")
    total_payments = cur.fetchone()[0]

    cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.transactions WHERE type='entry' AND status='completed'")
    payments_count = cur.fetchone()[0]

    cur.execute(f"SELECT COALESCE(SUM(amount), 0) FROM {SCHEMA}.transactions WHERE type='entry' AND status='completed' AND created_at >= now() - interval '30 days'")
    payments_month = cur.fetchone()[0]

    cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.entries")
    total_entries = cur.fetchone()[0]

    cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.raffles WHERE status='active'")
    active_raffles = cur.fetchone()[0]

    cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.raffles")
    total_raffles = cur.fetchone()[0]

    cur.execute(f"""
        SELECT DATE(created_at) as day, COUNT(*) as cnt, COALESCE(SUM(amount),0) as total
        FROM {SCHEMA}.transactions
        WHERE type='entry' AND status='completed' AND created_at >= now() - interval '30 days'
        GROUP BY day ORDER BY day
    """)
    payments_chart = [{'date': str(r[0]), 'count': r[1], 'amount': r[2]} for r in cur.fetchall()]

    cur.execute(f"""
        SELECT DATE(created_at) as day, COUNT(*) as cnt
        FROM {SCHEMA}.users
        WHERE created_at >= now() - interval '30 days'
        GROUP BY day ORDER BY day
    """)
    users_chart = [{'date': str(r[0]), 'count': r[1]} for r in cur.fetchall()]

    cur.close()
    conn.close()

    return {
        'statusCode': 200,
        'headers': CORS,
        'body': json.dumps({
            'ok': True,
            'users': {
                'total': total_users,
                'new_week': new_users_week,
                'new_month': new_users_month,
                'chart': users_chart,
            },
            'payments': {
                'total_amount': total_payments,
                'total_count': payments_count,
                'month_amount': payments_month,
                'chart': payments_chart,
            },
            'entries': {'total': total_entries},
            'raffles': {'active': active_raffles, 'total': total_raffles},
        })
    }