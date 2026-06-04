"""Диспетчерская: отправка заказов в Telegram и архив предварительных заказов."""
import os
import json
import urllib.request
import urllib.error
import psycopg2
import psycopg2.extras

SCHEMA = os.environ.get('MAIN_DB_SCHEMA') or 't_p67171637_yug_transfer_prize_l'


def db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def tg_send(text: str) -> dict:
    token = os.environ.get('TELEGRAM_BOT_TOKEN', '')
    chat_id = os.environ.get('DISPATCH_CHAT_ID', '')
    if not token:
        return {'ok': False, 'error': 'TELEGRAM_BOT_TOKEN не задан'}
    if not chat_id:
        return {'ok': False, 'error': 'DISPATCH_CHAT_ID не задан'}
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = json.dumps({
        'chat_id': chat_id,
        'text': text,
        'parse_mode': 'HTML',
        'disable_web_page_preview': True,
    }).encode()
    req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read())
            return {'ok': False, 'error': f"HTTP {e.code}: {body.get('description', '')[:200]}"}
        except Exception:
            return {'ok': False, 'error': f"HTTP {e.code}"}
    except Exception as e:
        return {'ok': False, 'error': f"{type(e).__name__}: {str(e)[:200]}"}


def esc(v) -> str:
    s = '' if v is None else str(v)
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def build_message(d: dict) -> str:
    lines = ['🚖 <b>НОВЫЙ ЗАКАЗ</b>', '']

    route = []
    if d.get('from_city'):
        route.append(f"📍 <b>Откуда:</b> {esc(d['from_city'])}")
    if d.get('to_city'):
        route.append(f"🏁 <b>Куда:</b> {esc(d['to_city'])}")
    if d.get('from_address'):
        route.append(f"➡️ <b>Откуда забрать:</b> {esc(d['from_address'])}")
    if d.get('to_address'):
        route.append(f"⬅️ <b>Куда довести:</b> {esc(d['to_address'])}")
    stops = d.get('stops') or []
    for i, s in enumerate(stops, 1):
        if s:
            route.append(f"🔸 <b>Промежуточный {i}:</b> {esc(s)}")
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
        order.append(f"📊 <b>Комиссия:</b> {esc(d['commission'])}%")
    if order:
        lines += order + ['']

    client = []
    if d.get('client_phone'):
        client.append(f"📞 <b>Клиент:</b> {esc(d['client_phone'])}")
    if d.get('people'):
        client.append(f"👥 <b>Человек:</b> {esc(d['people'])}")
    if d.get('luggage'):
        client.append(f"🧳 <b>Багаж:</b> {esc(d['luggage'])}")
    opts = []
    if d.get('booster'):
        opts.append('Бустер')
    if d.get('child_seat'):
        opts.append('Детское кресло')
    if d.get('animal'):
        opts.append('Животное')
    if opts:
        client.append(f"➕ <b>Опции:</b> {esc(', '.join(opts))}")
    if client:
        lines += client

    if d.get('comment'):
        lines += ['', f"💬 <b>Комментарий:</b> {esc(d['comment'])}"]

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

    # action == 'send' — отправка в Telegram, при необходимости удалить из архива.
    text = build_message(data)
    result = tg_send(text)
    if result.get('ok'):
        if data.get('id'):
            try:
                archive_delete(int(data['id']))
            except Exception:
                pass
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'ok': True})}
    return {'statusCode': 200, 'headers': cors,
            'body': json.dumps({'ok': False, 'error': result.get('error', 'fail')})}
