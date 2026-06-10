"""Клиентский личный кабинет: заявка на трансфер, регистрация/вход по паролю, статус заявок."""
import os
import json
import hashlib
import secrets

import psycopg2
import psycopg2.extras

SCHEMA = os.environ.get('MAIN_DB_SCHEMA') or 't_p67171637_yug_transfer_prize_l'

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Client-Phone, X-Client-Token, X-Admin-Token',
    'Access-Control-Max-Age': '86400',
}

STATUS_LABELS = {
    'new': 'Новая — ожидает обработки',
    'processing': 'В работе — подбираем водителя',
    'confirmed': 'Подтверждена — водитель назначен',
    'done': 'Выполнена',
    'cancelled': 'Отменена',
}


def db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def resp(status: int, body: dict) -> dict:
    return {'statusCode': status, 'headers': CORS, 'body': json.dumps(body, default=str)}


def norm_phone(raw: str) -> str:
    digits = ''.join(ch for ch in str(raw or '') if ch.isdigit())
    if len(digits) == 11 and digits.startswith('8'):
        digits = '7' + digits[1:]
    if len(digits) == 10:
        digits = '7' + digits
    return digits


def hash_password(password: str) -> str:
    return hashlib.sha256(('tg_transfer_salt_' + password).encode()).hexdigest()


def make_token() -> str:
    return secrets.token_hex(24)


def account_by_token(token: str):
    if not token:
        return None
    conn = db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        f"SELECT id, phone, name FROM {SCHEMA}.client_accounts WHERE token=%s",
        (token,),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    return dict(row) if row else None


def create_request(data: dict) -> dict:
    phone = norm_phone(data.get('phone'))
    if len(phone) != 11:
        return resp(400, {'ok': False, 'error': 'Укажите корректный номер телефона'})
    if not data.get('from_city') or not data.get('to_city'):
        return resp(400, {'ok': False, 'error': 'Укажите маршрут (откуда и куда)'})
    conn = db()
    cur = conn.cursor()
    cur.execute(
        f"INSERT INTO {SCHEMA}.client_requests "
        f"(phone, name, from_city, to_city, trip_date, trip_time, people, baggage, "
        f"tariff, child_seat, booster, animals, comment) "
        f"VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
        (phone, data.get('name', ''), data.get('from_city', ''), data.get('to_city', ''),
         data.get('trip_date', ''), data.get('trip_time', ''), data.get('people', ''),
         data.get('baggage', ''), data.get('tariff', ''),
         bool(data.get('child_seat')), bool(data.get('booster')), bool(data.get('animals')),
         data.get('comment', '')),
    )
    req_id = cur.fetchone()[0]
    conn.commit()

    # Дублируем заявку в архив диспетчерской (таблица dispatch_orders)
    name = (data.get('name') or '').strip()
    base_comment = (data.get('comment') or '').strip()
    parts = ['Заявка с сайта']
    if name:
        parts.append(f'Имя: {name}')
    if base_comment:
        parts.append(base_comment)
    disp_comment = '. '.join(parts)
    try:
        cur.execute(
            f"INSERT INTO {SCHEMA}.dispatch_orders "
            f"(from_city, to_city, order_date, order_time, tariff, client_phone, "
            f"people, luggage, child_seat, booster, animal, comment, sale_status) "
            f"VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'archived')",
            (data.get('from_city', ''), data.get('to_city', ''),
             data.get('trip_date', ''), data.get('trip_time', ''),
             data.get('tariff', ''), phone,
             data.get('people', ''), data.get('baggage', ''),
             bool(data.get('child_seat')), bool(data.get('booster')),
             bool(data.get('animals')), disp_comment),
        )
        conn.commit()
    except Exception:
        conn.rollback()

    cur.close()
    conn.close()
    return resp(200, {'ok': True, 'id': req_id})


def register(data: dict) -> dict:
    phone = norm_phone(data.get('phone'))
    password = str(data.get('password', ''))
    name = str(data.get('name', '')).strip()
    if len(phone) != 11:
        return resp(400, {'ok': False, 'error': 'Укажите корректный номер телефона'})
    if len(password) < 4:
        return resp(400, {'ok': False, 'error': 'Пароль должен быть не короче 4 символов'})
    conn = db()
    cur = conn.cursor()
    cur.execute(f"SELECT id FROM {SCHEMA}.client_accounts WHERE phone=%s", (phone,))
    if cur.fetchone():
        cur.close()
        conn.close()
        return resp(200, {'ok': False, 'error': 'Этот номер уже зарегистрирован. Войдите по паролю.'})
    token = make_token()
    cur.execute(
        f"INSERT INTO {SCHEMA}.client_accounts (phone, name, password_hash, token) "
        f"VALUES (%s,%s,%s,%s)",
        (phone, name, hash_password(password), token),
    )
    conn.commit()
    cur.close()
    conn.close()
    return resp(200, {'ok': True, 'token': token, 'phone': phone, 'name': name})


def login(data: dict) -> dict:
    phone = norm_phone(data.get('phone'))
    password = str(data.get('password', ''))
    if len(phone) != 11 or not password:
        return resp(400, {'ok': False, 'error': 'Введите телефон и пароль'})
    conn = db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        f"SELECT id, name, password_hash FROM {SCHEMA}.client_accounts WHERE phone=%s",
        (phone,),
    )
    row = cur.fetchone()
    if not row or row['password_hash'] != hash_password(password):
        cur.close()
        conn.close()
        return resp(200, {'ok': False, 'error': 'Неверный телефон или пароль'})
    token = make_token()
    cur.execute(f"UPDATE {SCHEMA}.client_accounts SET token=%s WHERE id=%s", (token, row['id']))
    conn.commit()
    cur.close()
    conn.close()
    return resp(200, {'ok': True, 'token': token, 'phone': phone, 'name': row['name'] or ''})


def me(event: dict) -> dict:
    token = (event.get('headers') or {}).get('X-Client-Token') or \
        (event.get('headers') or {}).get('x-client-token') or ''
    acc = account_by_token(token)
    if not acc:
        return resp(200, {'ok': False, 'error': 'Не авторизован'})
    return resp(200, {'ok': True, 'phone': acc['phone'], 'name': acc['name'] or ''})


def list_requests(phone: str) -> dict:
    phone = norm_phone(phone)
    if len(phone) != 11:
        return resp(400, {'ok': False, 'error': 'Нет телефона'})
    conn = db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        f"SELECT id, from_city, to_city, trip_date, trip_time, people, baggage, tariff, "
        f"child_seat, booster, animals, comment, status, created_at "
        f"FROM {SCHEMA}.client_requests WHERE phone=%s ORDER BY created_at DESC LIMIT 50",
        (phone,),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    items = []
    for r in rows:
        d = dict(r)
        d['status_label'] = STATUS_LABELS.get(d['status'], d['status'])
        items.append(d)
    return resp(200, {'ok': True, 'requests': items})


def is_admin(event: dict) -> bool:
    headers = event.get('headers') or {}
    token = headers.get('X-Admin-Token') or headers.get('x-admin-token') or ''
    return bool(token) and token == os.environ.get('ADMIN_PASSWORD', '')


def admin_list() -> dict:
    conn = db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        f"SELECT id, phone, name, from_city, to_city, trip_date, trip_time, people, "
        f"baggage, tariff, child_seat, booster, animals, comment, status, created_at "
        f"FROM {SCHEMA}.client_requests ORDER BY created_at DESC LIMIT 200"
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    items = []
    for r in rows:
        d = dict(r)
        d['status_label'] = STATUS_LABELS.get(d['status'], d['status'])
        items.append(d)
    return resp(200, {'ok': True, 'requests': items})


def admin_set_status(data: dict) -> dict:
    req_id = data.get('id')
    status = str(data.get('status', '')).strip()
    if not req_id or status not in STATUS_LABELS:
        return resp(400, {'ok': False, 'error': 'Некорректные данные'})
    conn = db()
    cur = conn.cursor()
    cur.execute(
        f"UPDATE {SCHEMA}.client_requests SET status=%s, updated_at=NOW() WHERE id=%s",
        (status, int(req_id)),
    )
    conn.commit()
    cur.close()
    conn.close()
    return resp(200, {'ok': True})


def handler(event: dict, context) -> dict:
    """Клиентский кабинет: заявки на трансфер, регистрация/вход по паролю, статус заявок."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    qs = event.get('queryStringParameters') or {}
    action = (qs.get('action') or '').strip()

    if event.get('httpMethod') == 'GET':
        if action == 'requests':
            headers = event.get('headers') or {}
            token = headers.get('X-Client-Token') or headers.get('x-client-token') or ''
            acc = account_by_token(token)
            if not acc:
                return resp(200, {'ok': False, 'error': 'Не авторизован'})
            return list_requests(acc['phone'])
        if action == 'me':
            return me(event)
        if action == 'admin_list':
            if not is_admin(event):
                return resp(403, {'ok': False, 'error': 'forbidden'})
            return admin_list()
        return resp(200, {'ok': True, 'service': 'client-cabinet'})

    if event.get('httpMethod') != 'POST':
        return resp(405, {'ok': False, 'error': 'method not allowed'})

    try:
        data = json.loads(event.get('body') or '{}')
    except Exception:
        return resp(400, {'ok': False, 'error': 'bad json'})

    if action == 'create_request':
        return create_request(data)
    if action == 'register':
        return register(data)
    if action == 'login':
        return login(data)
    if action == 'admin_set_status':
        if not is_admin(event):
            return resp(403, {'ok': False, 'error': 'forbidden'})
        return admin_set_status(data)

    return resp(400, {'ok': False, 'error': 'unknown action'})