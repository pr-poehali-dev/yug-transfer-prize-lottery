"""Клиентский личный кабинет: заявка на трансфер, вход по SMS-коду, статус заявок."""
import os
import json
import random
import urllib.request
import urllib.parse
from datetime import datetime, timedelta

import psycopg2
import psycopg2.extras

SCHEMA = os.environ.get('MAIN_DB_SCHEMA') or 't_p67171637_yug_transfer_prize_l'

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Client-Phone, X-Admin-Token',
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


def send_sms(phone: str, text: str) -> dict:
    api_id = os.environ.get('SMSRU_API_ID', '')
    if not api_id:
        return {'ok': False, 'error': 'SMS не настроена'}
    params = urllib.parse.urlencode({
        'api_id': api_id, 'to': phone, 'msg': text, 'json': 1,
    })
    url = f'https://sms.ru/sms/send?{params}'
    try:
        with urllib.request.urlopen(url, timeout=15) as r:
            data = json.loads(r.read())
        if data.get('status') == 'OK':
            return {'ok': True}
        return {'ok': False, 'error': data.get('status_text', 'Ошибка SMS')}
    except Exception as e:
        return {'ok': False, 'error': f'{type(e).__name__}: {str(e)[:150]}'}


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


def send_code(data: dict) -> dict:
    phone = norm_phone(data.get('phone'))
    if len(phone) != 11:
        return resp(400, {'ok': False, 'error': 'Укажите корректный номер телефона'})
    code = f'{random.randint(0, 9999):04d}'
    expires = datetime.utcnow() + timedelta(minutes=10)
    conn = db()
    cur = conn.cursor()
    cur.execute(
        f"INSERT INTO {SCHEMA}.client_auth_codes (phone, code, expires_at) VALUES (%s,%s,%s)",
        (phone, code, expires),
    )
    conn.commit()
    cur.close()
    conn.close()
    sms = send_sms(phone, f'Код для входа в личный кабинет: {code}')
    if not sms.get('ok'):
        return resp(200, {'ok': False, 'error': sms.get('error', 'Не удалось отправить SMS')})
    return resp(200, {'ok': True})


def verify_code(data: dict) -> dict:
    phone = norm_phone(data.get('phone'))
    code = str(data.get('code', '')).strip()
    if len(phone) != 11 or not code:
        return resp(400, {'ok': False, 'error': 'Введите телефон и код'})
    conn = db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        f"SELECT id, code, expires_at, used, attempts FROM {SCHEMA}.client_auth_codes "
        f"WHERE phone=%s ORDER BY created_at DESC LIMIT 1",
        (phone,),
    )
    row = cur.fetchone()
    if not row or row['used'] or row['expires_at'] < datetime.utcnow():
        cur.close()
        conn.close()
        return resp(200, {'ok': False, 'error': 'Код не найден или истёк. Запросите новый.'})
    if row['attempts'] >= 5:
        cur.close()
        conn.close()
        return resp(200, {'ok': False, 'error': 'Слишком много попыток. Запросите новый код.'})
    if row['code'] != code:
        cur.execute(f"UPDATE {SCHEMA}.client_auth_codes SET attempts=attempts+1 WHERE id=%s", (row['id'],))
        conn.commit()
        cur.close()
        conn.close()
        return resp(200, {'ok': False, 'error': 'Неверный код'})
    cur.execute(f"UPDATE {SCHEMA}.client_auth_codes SET used=TRUE WHERE id=%s", (row['id'],))
    conn.commit()
    cur.close()
    conn.close()
    return resp(200, {'ok': True, 'phone': phone})


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
    """Клиентский кабинет: заявки на трансфер и отслеживание статуса по SMS-коду."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    qs = event.get('queryStringParameters') or {}
    action = (qs.get('action') or '').strip()

    if event.get('httpMethod') == 'GET':
        if action == 'requests':
            phone = (event.get('headers') or {}).get('X-Client-Phone') or qs.get('phone', '')
            return list_requests(phone)
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
    if action == 'send_code':
        return send_code(data)
    if action == 'verify_code':
        return verify_code(data)
    if action == 'admin_set_status':
        if not is_admin(event):
            return resp(403, {'ok': False, 'error': 'forbidden'})
        return admin_set_status(data)

    return resp(400, {'ok': False, 'error': 'unknown action'})