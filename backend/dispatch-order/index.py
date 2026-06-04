"""Приём заявок из раздела «Диспетчерская» и отправка их в Telegram."""
import os
import json
import urllib.request
import urllib.error


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


def handler(event: dict, context) -> dict:
    """Принимает заявку из формы диспетчерской и отправляет её в Telegram-чат."""
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
        'Access-Control-Max-Age': '86400',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    if event.get('httpMethod') != 'POST':
        return {'statusCode': 405, 'headers': cors, 'body': json.dumps({'ok': False, 'error': 'method not allowed'})}

    try:
        data = json.loads(event.get('body') or '{}')
    except Exception:
        return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'ok': False, 'error': 'bad json'})}

    if not data.get('from_city') and not data.get('to_city') and not data.get('client_phone'):
        return {'statusCode': 400, 'headers': cors,
                'body': json.dumps({'ok': False, 'error': 'Заполни хотя бы маршрут или телефон клиента'})}

    text = build_message(data)
    result = tg_send(text)

    if result.get('ok'):
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'ok': True})}
    return {'statusCode': 200, 'headers': cors,
            'body': json.dumps({'ok': False, 'error': result.get('error', 'fail')})}
