"""
Business: Возвращает админу список подписок водителей со статусами и сроком действия.
Args: event с httpMethod, headers (X-Admin-Token)
Returns: {ok, subs: [...], total_active}
"""
import json
import os
import psycopg2
import psycopg2.extras

DB_URL = os.environ.get('DATABASE_URL', '')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', '')
SCHEMA = os.environ.get('MAIN_DB_SCHEMA') or 't_p67171637_yug_transfer_prize_l'


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

    qs = event.get('queryStringParameters') or {}
    conn = psycopg2.connect(DB_URL)
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Журнал всех платежей и возвратов.
        if qs.get('action') == 'payments':
            cur.execute(
                f"SELECT id, kind, tg_user_id, username, first_name, amount_rub, "
                f"order_id, payment_id, note, created_at "
                f"FROM {SCHEMA}.payment_log ORDER BY created_at DESC LIMIT 500"
            )
            payments = []
            total_in = 0.0
            total_refund = 0.0
            for r in cur.fetchall():
                amt = float(r['amount_rub'] or 0)
                if r['kind'] in ('commission', 'subscription'):
                    total_in += amt
                elif r['kind'] == 'refund':
                    total_refund += amt
                payments.append({
                    'id': r['id'],
                    'kind': r['kind'],
                    'tg_user_id': r['tg_user_id'],
                    'username': r['username'] or '',
                    'first_name': r['first_name'] or '',
                    'amount_rub': amt,
                    'order_id': r['order_id'],
                    'payment_id': r['payment_id'] or '',
                    'note': r['note'] or '',
                    'created_at': r['created_at'].isoformat() if r['created_at'] else None,
                })
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps({
                'ok': True, 'payments': payments,
                'total_income': round(total_in, 2), 'total_refund': round(total_refund, 2),
            })}

        cur.execute(
            f"SELECT tg_user_id, username, first_name, active_until, updated_at, "
            f"(active_until IS NOT NULL AND active_until > NOW()) AS is_active "
            f"FROM {SCHEMA}.driver_subs "
            f"ORDER BY (active_until IS NOT NULL AND active_until > NOW()) DESC, active_until DESC NULLS LAST "
            f"LIMIT 500"
        )
        subs = []
        active = 0
        for r in cur.fetchall():
            sub = {
                'tg_user_id': r['tg_user_id'],
                'username': r['username'] or '',
                'first_name': r['first_name'] or '',
                'active_until': r['active_until'].isoformat() if r['active_until'] else None,
                'updated_at': r['updated_at'].isoformat() if r['updated_at'] else None,
                'is_active': bool(r['is_active']),
            }
            subs.append(sub)
            if sub['is_active']:
                active += 1

        return {'statusCode': 200, 'headers': headers, 'body': json.dumps({
            'ok': True, 'subs': subs, 'total_active': active,
        })}
    finally:
        conn.close()