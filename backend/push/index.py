"""
Web Push уведомления: регистрация подписки, рассылка всем подписчикам.
GET  /vapid-key   — возвращает публичный VAPID ключ для клиента
POST /subscribe   — сохраняет подписку браузера
POST /send        — рассылает push всем подписчикам (только для админа)
"""
import os
import json
import hashlib
import psycopg2
from pywebpush import webpush, WebPushException

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Admin-Token',
}

SCHEMA = 't_p67171637_yug_transfer_prize_l'


def verify_admin(token: str) -> bool:
    admin_login = os.environ.get('ADMIN_LOGIN', '')
    admin_password = os.environ.get('ADMIN_PASSWORD', '')
    token_base = f"{admin_login}:{admin_password}:admin_secret_2026"
    return token == hashlib.sha256(token_base.encode()).hexdigest()


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    path = event.get('path', '').rstrip('/')
    method = event.get('httpMethod', 'GET')

    vapid_private = os.environ.get('VAPID_PRIVATE_KEY', '')
    vapid_public = os.environ.get('VAPID_PUBLIC_KEY', '')
    vapid_claims = {'sub': 'mailto:admin@ug-gift.ru'}

    # GET /vapid-key — публичный ключ для клиента
    if method == 'GET':
        return {
            'statusCode': 200,
            'headers': CORS,
            'body': json.dumps({'ok': True, 'public_key': vapid_public}),
        }

    body = json.loads(event.get('body') or '{}')
    action = body.get('action', '')

    # POST subscribe — сохранить подписку браузера
    if action == 'subscribe':
        subscription = body.get('subscription', {})
        user_id = event.get('headers', {}).get('X-User-Id')
        endpoint = subscription.get('endpoint', '')
        keys = subscription.get('keys', {})
        p256dh = keys.get('p256dh', '')
        auth = keys.get('auth', '')

        if not endpoint or not p256dh or not auth:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Invalid subscription'})}

        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            f"""INSERT INTO {SCHEMA}.push_subscriptions (user_id, endpoint, p256dh, auth)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (endpoint) DO UPDATE SET user_id=EXCLUDED.user_id, p256dh=EXCLUDED.p256dh, auth=EXCLUDED.auth""",
            (int(user_id) if user_id else None, endpoint, p256dh, auth)
        )
        conn.commit()
        cur.close()
        conn.close()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

    # POST unsubscribe — удалить подписку
    if action == 'unsubscribe':
        endpoint = body.get('endpoint', '')
        if endpoint:
            conn = get_conn()
            cur = conn.cursor()
            cur.execute(f"UPDATE {SCHEMA}.push_subscriptions SET user_id=NULL WHERE endpoint=%s", (endpoint,))
            conn.commit()
            cur.close()
            conn.close()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

    # POST send — рассылка (только для админа)
    if action == 'send':
        token = event.get('headers', {}).get('X-Admin-Token', '')
        if not verify_admin(token):
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Unauthorized'})}

        title = body.get('title', '')
        message = body.get('message', '')
        url = body.get('url', '/')

        if not title or not message:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'title и message обязательны'})}

        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"SELECT endpoint, p256dh, auth FROM {SCHEMA}.push_subscriptions")
        rows = cur.fetchall()
        cur.close()
        conn.close()

        sent = 0
        failed_endpoints = []
        payload = json.dumps({'title': title, 'body': message, 'url': url, 'tag': 'yug-broadcast'})

        for endpoint, p256dh, auth in rows:
            try:
                webpush(
                    subscription_info={'endpoint': endpoint, 'keys': {'p256dh': p256dh, 'auth': auth}},
                    data=payload,
                    vapid_private_key=vapid_private,
                    vapid_claims=vapid_claims,
                )
                sent += 1
            except WebPushException as ex:
                if ex.response and ex.response.status_code in (404, 410):
                    failed_endpoints.append(endpoint)
            except Exception:
                pass

        return {
            'statusCode': 200,
            'headers': CORS,
            'body': json.dumps({'ok': True, 'sent': sent, 'total': len(rows), 'failed': len(failed_endpoints)}),
        }

    # POST count — кол-во подписчиков
    if action == 'count':
        token = event.get('headers', {}).get('X-Admin-Token', '')
        if not verify_admin(token):
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Unauthorized'})}
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.push_subscriptions")
        count = cur.fetchone()[0]
        cur.close()
        conn.close()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'count': count})}

    return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Unknown action'})}
