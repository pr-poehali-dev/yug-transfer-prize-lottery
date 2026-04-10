"""
Платежи через ЮKassa.
POST /create  — создать платёж на пополнение баланса
POST /webhook — вебхук от ЮKassa, зачисляет баланс после успешной оплаты
"""
import os
import json
import uuid
import psycopg2
import urllib.request
import urllib.error
import base64

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
}

YOOKASSA_URL = 'https://api.yookassa.ru/v3/payments'


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def get_schema():
    return os.environ.get('MAIN_DB_SCHEMA', 'public')


def yk_auth_header():
    shop_id = os.environ.get('YOOKASSA_SHOP_ID', '')
    secret = os.environ.get('YOOKASSA_SECRET_KEY', '')
    token = base64.b64encode(f"{shop_id}:{secret}".encode()).decode()
    return f"Basic {token}"


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    qs = event.get('queryStringParameters') or {}
    action = qs.get('action', '')
    if not action:
        path = event.get('path', '').rstrip('/')
        action = path.split('/')[-1]

    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Invalid JSON'})}

    schema = get_schema()

    # Создать платёж
    if action == 'create':
        headers = event.get('headers') or {}
        user_id = headers.get('X-User-Id') or headers.get('x-user-id')
        if not user_id:
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Unauthorized'})}

        amount = int(body.get('amount', 0))
        if amount < 100:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Минимальная сумма 100 ₽'})}

        idempotency_key = str(uuid.uuid4())
        return_url = body.get('return_url', 'https://poehali.dev')

        payload = {
            'amount': {'value': f'{amount}.00', 'currency': 'RUB'},
            'confirmation': {'type': 'redirect', 'return_url': return_url},
            'capture': True,
            'description': f'Пополнение баланса на {amount} ₽',
            'metadata': {'user_id': str(user_id)},
        }

        req = urllib.request.Request(
            YOOKASSA_URL,
            data=json.dumps(payload).encode(),
            headers={
                'Authorization': yk_auth_header(),
                'Content-Type': 'application/json',
                'Idempotence-Key': idempotency_key,
            },
            method='POST',
        )
        try:
            with urllib.request.urlopen(req) as resp:
                yk_data = json.loads(resp.read())
        except urllib.error.HTTPError as e:
            err = e.read().decode()
            return {'statusCode': 502, 'headers': CORS, 'body': json.dumps({'error': 'ЮKassa error', 'detail': err})}

        payment_id = yk_data['id']
        confirm_url = yk_data['confirmation']['confirmation_url']

        # Сохраняем транзакцию со статусом pending
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"""
            INSERT INTO {schema}.transactions (user_id, type, amount, description, payment_id, status)
            VALUES (%s, 'deposit', %s, %s, %s, 'pending')
        """, (user_id, amount, f'Пополнение баланса на {amount} ₽', payment_id))
        conn.commit()
        cur.close()
        conn.close()

        return {'statusCode': 200, 'headers': CORS,
                'body': json.dumps({'ok': True, 'payment_id': payment_id, 'confirmation_url': confirm_url})}

    # Вебхук от ЮKassa
    if action == 'webhook':
        event_type = body.get('event', '')
        obj = body.get('object', {})
        payment_id = obj.get('id', '')
        status = obj.get('status', '')
        metadata = obj.get('metadata', {})
        user_id = metadata.get('user_id')
        amount_val = obj.get('amount', {})
        amount = int(float(amount_val.get('value', 0)))

        if event_type == 'payment.succeeded' and status == 'succeeded' and user_id:
            conn = get_conn()
            cur = conn.cursor()
            # Проверяем, не обработан ли уже этот платёж
            cur.execute(f"SELECT status FROM {schema}.transactions WHERE payment_id = %s", (payment_id,))
            row = cur.fetchone()
            if row and row[0] != 'succeeded':
                # Зачисляем баланс
                cur.execute(f"UPDATE {schema}.users SET balance = balance + %s WHERE id = %s", (amount, user_id))
                cur.execute(f"UPDATE {schema}.transactions SET status = 'succeeded' WHERE payment_id = %s", (payment_id,))
                conn.commit()
            cur.close()
            conn.close()

        if event_type == 'payment.canceled':
            conn = get_conn()
            cur = conn.cursor()
            cur.execute(f"UPDATE {schema}.transactions SET status = 'canceled' WHERE payment_id = %s", (payment_id,))
            conn.commit()
            cur.close()
            conn.close()

        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

    return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Not found'})}