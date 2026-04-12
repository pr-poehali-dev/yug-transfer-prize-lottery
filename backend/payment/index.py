"""
Платежи через ЮKassa. v3
POST ?action=create  — создать платёж за участие в розыгрыше
POST ?action=webhook — вебхук от ЮKassa, записывает участие после успешной оплаты
GET  ?action=check&payment_id=XXX — проверить статус платежа
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
}

YOOKASSA_URL = 'https://api.yookassa.ru/v3/payments'
SCHEMA = 't_p67171637_yug_transfer_prize_l'


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def yk_auth_header():
    shop_id = os.environ.get('YUKASSA_SHOP_ID', '')
    secret = os.environ.get('YUKASSA_SECRET_KEY', '')
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

    # Создать платёж за участие в розыгрыше
    if action == 'create':
        headers = event.get('headers') or {}
        user_id_raw = headers.get('X-User-Id') or headers.get('x-user-id')
        if not user_id_raw:
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Unauthorized'})}
        try:
            user_id = int(user_id_raw)
        except (ValueError, TypeError):
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Invalid user_id'})}

        raffle_id = body.get('raffle_id')
        raffle_title = body.get('raffle_title', 'Розыгрыш')
        amount = int(body.get('amount', 0))
        return_url = body.get('return_url', 'https://ug-gift.ru?payment=success')

        if not raffle_id:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'raffle_id обязателен'})}
        if amount < 1:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Некорректная сумма'})}

        idempotency_key = str(uuid.uuid4())
        payload = {
            'amount': {'value': f'{amount}.00', 'currency': 'RUB'},
            'confirmation': {'type': 'redirect', 'return_url': return_url},
            'capture': True,
            'description': f'Участие в розыгрыше: {raffle_title}',
            'metadata': {
                'user_id': str(user_id),
                'raffle_id': str(raffle_id),
                'raffle_title': raffle_title,
                'amount': str(amount),
            },
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
            print(f"[YK] payment created: id={yk_data.get('id')} status={yk_data.get('status')} url={yk_data.get('confirmation', {}).get('confirmation_url', '')[:80]}")
        except urllib.error.HTTPError as e:
            err = e.read().decode()
            print(f"[YK error] status={e.code} body={err}")
            return {'statusCode': 502, 'headers': CORS, 'body': json.dumps({'ok': False, 'error': f'ЮKassa: {err}'})}

        payment_id = yk_data['id']
        confirm_url = yk_data['confirmation']['confirmation_url']
        print(f"[YK] confirm_url={confirm_url}")

        # Сохраняем транзакцию pending
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO {SCHEMA}.transactions (user_id, type, amount, description, payment_id, status) "
            f"VALUES (%s, 'entry', %s, %s, %s, 'pending')",
            (user_id, amount, f'Участие: {raffle_title}', payment_id)
        )
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
        user_id = int(metadata.get('user_id') or 0) or None
        raffle_id = int(metadata.get('raffle_id') or 0) or None
        raffle_title = metadata.get('raffle_title', '')
        amount_val = obj.get('amount', {})
        amount = int(float(amount_val.get('value', 0)))

        if event_type == 'payment.succeeded' and status == 'succeeded' and user_id and raffle_id:
            conn = get_conn()
            cur = conn.cursor()

            # Идемпотентность — не обрабатываем дважды по payment_id
            cur.execute(f"SELECT status FROM {SCHEMA}.transactions WHERE payment_id = %s", (payment_id,))
            row = cur.fetchone()
            if row and row[0] != 'succeeded':
                # Проверяем что entry ещё не создан (дополнительная защита от дублей)
                cur.execute(
                    f"SELECT id FROM {SCHEMA}.entries WHERE payment_id = %s",
                    (payment_id,)
                )
                already_exists = cur.fetchone()
                if not already_exists:
                    # Записываем участие в розыгрыше
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.entries (user_id, raffle_id, tickets, amount, payment_id) "
                        f"VALUES (%s, %s, 1, %s, %s)",
                        (user_id, raffle_id, amount, payment_id)
                    )
                    # Увеличиваем счётчик участников розыгрыша
                    cur.execute(
                        f"UPDATE {SCHEMA}.raffles SET participants = participants + 1 WHERE id = %s",
                        (raffle_id,)
                    )
                    # Обновляем статистику пользователя
                    cur.execute(
                        f"UPDATE {SCHEMA}.users SET total_entries = total_entries + 1, total_spent = total_spent + %s WHERE id = %s",
                        (amount, user_id)
                    )
                    print(f"[PAYMENT] user {user_id} entered raffle {raffle_id} for {amount}₽")
                else:
                    print(f"[PAYMENT] duplicate webhook skipped for payment {payment_id}")
                # Обновляем транзакцию в любом случае
                cur.execute(
                    f"UPDATE {SCHEMA}.transactions SET status = 'completed', description = %s WHERE payment_id = %s",
                    (f'Участие: {raffle_title}', payment_id)
                )
                conn.commit()

            cur.close()
            conn.close()

        if event_type == 'payment.canceled':
            conn = get_conn()
            cur = conn.cursor()
            cur.execute(f"UPDATE {SCHEMA}.transactions SET status = 'canceled' WHERE payment_id = %s", (payment_id,))
            conn.commit()
            cur.close()
            conn.close()

        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

    # Проверить статус платежа по payment_id
    if action == 'check':
        payment_id = qs.get('payment_id', '')
        if not payment_id:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'payment_id обязателен'})}

        # Сначала проверяем в нашей БД
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            f"SELECT status FROM {SCHEMA}.transactions WHERE payment_id = %s LIMIT 1",
            (payment_id,)
        )
        row = cur.fetchone()
        cur.close()
        conn.close()

        if row and row[0] == 'completed':
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'status': 'succeeded'})}

        # Если в БД ещё pending — проверяем напрямую у ЮКассы
        req = urllib.request.Request(
            f"{YOOKASSA_URL}/{payment_id}",
            headers={'Authorization': yk_auth_header()},
            method='GET',
        )
        try:
            with urllib.request.urlopen(req) as resp:
                yk_data = json.loads(resp.read())
            yk_status = yk_data.get('status', '')
            print(f"[YK check] payment_id={payment_id} status={yk_status}")
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'status': yk_status})}
        except urllib.error.HTTPError as e:
            err = e.read().decode()
            return {'statusCode': 502, 'headers': CORS, 'body': json.dumps({'ok': False, 'error': f'ЮKassa: {err}'})}

    return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Not found'})}