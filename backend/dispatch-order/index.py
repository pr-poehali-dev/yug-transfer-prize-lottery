"""Диспетчерская: отправка заказов в Telegram и архив предварительных заказов."""
import os
import json
import time
import urllib.request
import urllib.error
import psycopg2
import psycopg2.extras

SCHEMA = os.environ.get('MAIN_DB_SCHEMA') or 't_p67171637_yug_transfer_prize_l'


def db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


BOT_USERNAME = 'zacazubot'
ACCEPT_BUTTON_TEXT = '✅ Принять заказ'


def tg_send(text: str, order_id: int) -> dict:
    token = (os.environ.get('ZACAZU_BOT_TOKEN_NEW', '')
             or os.environ.get('ZACAZU_BOT_TOKEN', '')
             or os.environ.get('TELEGRAM_BOT_TOKEN', ''))
    chat_id = os.environ.get('DISPATCH_CHAT_ID', '')
    if not token:
        return {'ok': False, 'error': 'ZACAZU_BOT_TOKEN не задан'}
    if not chat_id:
        return {'ok': False, 'error': 'DISPATCH_CHAT_ID не задан'}
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = json.dumps({
        'chat_id': chat_id,
        'text': text,
        'parse_mode': 'HTML',
        'disable_web_page_preview': True,
        'reply_markup': {
            'inline_keyboard': [[
                {'text': ACCEPT_BUTTON_TEXT,
                 'url': f'https://t.me/{BOT_USERNAME}?start=accept_{order_id}'}
            ]]
        },
    }).encode()
    last_err = 'fail'
    # До 3 попыток: единичные сетевые таймауты Telegram не должны срывать отправку.
    for attempt in range(3):
        req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json'}, method='POST')
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            try:
                body = json.loads(e.read())
                return {'ok': False, 'error': f"HTTP {e.code}: {body.get('description', '')[:200]}"}
            except Exception:
                return {'ok': False, 'error': f"HTTP {e.code}"}
        except Exception as e:
            last_err = f"{type(e).__name__}: {str(e)[:200]}"
            if attempt < 2:
                time.sleep(2)
    return {'ok': False, 'error': last_err}


def parse_num(v) -> float:
    s = str(v or '').replace(',', '.')
    digits = ''.join(ch for ch in s if (ch.isdigit() or ch == '.'))
    try:
        return float(digits) if digits else 0.0
    except Exception:
        return 0.0


def calc_commission_rub(price, commission_pct) -> float:
    price_num = parse_num(price)
    pct = parse_num(commission_pct)
    return round(price_num * pct / 100.0, 2)


def esc(v) -> str:
    s = '' if v is None else str(v)
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def fmt_pct(v) -> str:
    """Возвращает процент без задвоения знака %."""
    s = str(v or '').strip()
    return s if s.endswith('%') else f"{s}%"


def build_message(d: dict) -> str:
    """Публичное сообщение в группу — БЕЗ точных адресов и контактов клиента."""
    lines = ['🚖 <b>НОВЫЙ ЗАКАЗ</b>', '']

    route = []
    if d.get('from_city'):
        route.append(f"📍 <b>Откуда:</b> {esc(d['from_city'])}")
    if d.get('to_city'):
        route.append(f"🏁 <b>Куда:</b> {esc(d['to_city'])}")
    if route:
        lines += route + ['']

    order = []
    if d.get('date'):
        order.append(f"📅 <b>Дата:</b> {esc(d['date'])}")
    if d.get('time'):
        order.append(f"🕐 <b>Время:</b> {esc(d['time'])}")
    if d.get('price'):
        order.append(f"💰 <b>Стоимость:</b> {esc(d['price'])} ₽")
    if d.get('tariff'):
        order.append(f"🎫 <b>Тариф:</b> {esc(d['tariff'])}")
    if d.get('commission'):
        order.append(f"📊 <b>Комиссия:</b> {esc(fmt_pct(d['commission']))}")
    if order:
        lines += order

    # Адреса и данные клиента в группу НЕ отправляем —
    # они приходят победителю в личку после оплаты.
    return '\n'.join(lines)


def has_content(d: dict) -> bool:
    return bool(d.get('from_city') or d.get('to_city') or d.get('client_phone'))


def row_to_order(r: dict) -> dict:
    stops = r.get('stops')
    if isinstance(stops, str):
        try:
            stops = json.loads(stops)
        except Exception:
            stops = []
    return {
        'id': r['id'],
        'from_city': r['from_city'] or '',
        'to_city': r['to_city'] or '',
        'from_address': r['from_address'] or '',
        'to_address': r['to_address'] or '',
        'stops': stops or [],
        'date': r['order_date'] or '',
        'time': r['order_time'] or '',
        'price': r['price'] or '',
        'tariff': r['tariff'] or '',
        'commission': r['commission'] or '',
        'client_phone': r['client_phone'] or '',
        'people': r['people'] or '',
        'luggage': r['luggage'] or '',
        'booster': bool(r['booster']),
        'child_seat': bool(r['child_seat']),
        'animal': bool(r['animal']),
        'comment': r['comment'] or '',
        'created_at': r['created_at'].isoformat() if r.get('created_at') else None,
        'sale_status': r.get('sale_status') or 'archived',
        'trip_status': r.get('trip_status') or '',
    }


def archive_save(d: dict) -> dict:
    conn = db()
    cur = conn.cursor()
    cur.execute(
        f"INSERT INTO {SCHEMA}.dispatch_orders "
        f"(from_city, to_city, from_address, to_address, stops, order_date, order_time, "
        f"price, tariff, commission, client_phone, people, luggage, booster, child_seat, animal, comment) "
        f"VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
        (
            d.get('from_city', ''), d.get('to_city', ''), d.get('from_address', ''), d.get('to_address', ''),
            json.dumps([s for s in (d.get('stops') or []) if s]), d.get('date', ''), d.get('time', ''),
            str(d.get('price', '')), d.get('tariff', ''), d.get('commission', ''),
            d.get('client_phone', ''), str(d.get('people', '')), str(d.get('luggage', '')),
            bool(d.get('booster')), bool(d.get('child_seat')), bool(d.get('animal')), d.get('comment', ''),
        ),
    )
    new_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return {'ok': True, 'id': new_id}


def archive_list() -> dict:
    conn = db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(f"SELECT * FROM {SCHEMA}.dispatch_orders ORDER BY created_at DESC LIMIT 200")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return {'ok': True, 'orders': [row_to_order(dict(r)) for r in rows]}


def archive_delete(order_id: int) -> dict:
    conn = db()
    cur = conn.cursor()
    cur.execute(f"DELETE FROM {SCHEMA}.dispatch_orders WHERE id = %s", (order_id,))
    conn.commit()
    cur.close()
    conn.close()
    return {'ok': True}


def prepare_order_for_sale(d: dict) -> int:
    """Сохраняет/обновляет заказ как «продаётся», возвращает его id."""
    commission_rub = calc_commission_rub(d.get('price'), d.get('commission'))
    chat_id = os.environ.get('DISPATCH_CHAT_ID', '')
    conn = db()
    cur = conn.cursor()
    if d.get('id'):
        oid = int(d['id'])
        cur.execute(
            f"UPDATE {SCHEMA}.dispatch_orders SET "
            f"from_city=%s, to_city=%s, from_address=%s, to_address=%s, stops=%s, order_date=%s, order_time=%s, "
            f"price=%s, tariff=%s, commission=%s, client_phone=%s, people=%s, luggage=%s, "
            f"booster=%s, child_seat=%s, animal=%s, comment=%s, commission_rub=%s, "
            f"sale_status='selling', tg_chat_id=%s, current_user_id=NULL, current_deadline=NULL, winner_user_id=NULL "
            f"WHERE id=%s",
            (
                d.get('from_city', ''), d.get('to_city', ''), d.get('from_address', ''), d.get('to_address', ''),
                json.dumps([s for s in (d.get('stops') or []) if s]), d.get('date', ''), d.get('time', ''),
                str(d.get('price', '')), d.get('tariff', ''), d.get('commission', ''),
                d.get('client_phone', ''), str(d.get('people', '')), str(d.get('luggage', '')),
                bool(d.get('booster')), bool(d.get('child_seat')), bool(d.get('animal')), d.get('comment', ''),
                commission_rub, chat_id, oid,
            ),
        )
    else:
        cur.execute(
            f"INSERT INTO {SCHEMA}.dispatch_orders "
            f"(from_city, to_city, from_address, to_address, stops, order_date, order_time, "
            f"price, tariff, commission, client_phone, people, luggage, booster, child_seat, animal, comment, "
            f"commission_rub, sale_status, tg_chat_id) "
            f"VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'selling',%s) RETURNING id",
            (
                d.get('from_city', ''), d.get('to_city', ''), d.get('from_address', ''), d.get('to_address', ''),
                json.dumps([s for s in (d.get('stops') or []) if s]), d.get('date', ''), d.get('time', ''),
                str(d.get('price', '')), d.get('tariff', ''), d.get('commission', ''),
                d.get('client_phone', ''), str(d.get('people', '')), str(d.get('luggage', '')),
                bool(d.get('booster')), bool(d.get('child_seat')), bool(d.get('animal')), d.get('comment', ''),
                commission_rub, chat_id,
            ),
        )
        oid = cur.fetchone()[0]
    # Очищаем старую очередь при повторной публикации
    cur.execute(f"DELETE FROM {SCHEMA}.order_queue WHERE order_id=%s", (oid,))
    conn.commit()
    cur.close()
    conn.close()
    return oid


def set_order_message(order_id: int, message_id, text: str = ''):
    conn = db()
    cur = conn.cursor()
    cur.execute(
        f"UPDATE {SCHEMA}.dispatch_orders SET tg_message_id=%s, tg_message_text=%s WHERE id=%s",
        (message_id, text, order_id),
    )
    conn.commit()
    cur.close()
    conn.close()


def handler(event: dict, context) -> dict:
    """Диспетчерская: action=send (в Telegram), archive_save, archive_list, archive_delete."""
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
        'Access-Control-Max-Age': '86400',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    qs = event.get('queryStringParameters') or {}
    action = (qs.get('action') or 'send').strip()

    if action == 'archive_list':
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps(archive_list())}

    if event.get('httpMethod') != 'POST':
        return {'statusCode': 405, 'headers': cors, 'body': json.dumps({'ok': False, 'error': 'method not allowed'})}

    try:
        data = json.loads(event.get('body') or '{}')
    except Exception:
        return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'ok': False, 'error': 'bad json'})}

    if action == 'archive_delete':
        oid = data.get('id')
        if not oid:
            return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'ok': False, 'error': 'no id'})}
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps(archive_delete(int(oid)))}

    if not has_content(data):
        return {'statusCode': 400, 'headers': cors,
                'body': json.dumps({'ok': False, 'error': 'Заполни хотя бы маршрут или телефон клиента'})}

    if action == 'archive_save':
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps(archive_save(data))}

    # action == 'send' — публикация заказа на продажу с кнопкой «Принять заказ».
    commission_rub = calc_commission_rub(data.get('price'), data.get('commission'))
    text = build_message(data)
    if commission_rub > 0:
        text += f"\n\n💳 <b>Комиссия за заказ:</b> {commission_rub:.0f} ₽"
    text += "\n\n👉 Нажми «Принять заказ» и оплати комиссию в течение 5 минут."

    order_id = prepare_order_for_sale(data)
    result = tg_send(text, order_id)
    if result.get('ok'):
        msg_id = (result.get('result') or {}).get('message_id')
        if msg_id:
            set_order_message(order_id, msg_id, text)
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'ok': True, 'order_id': order_id})}
    return {'statusCode': 200, 'headers': cors,
            'body': json.dumps({'ok': False, 'error': result.get('error', 'fail')})}