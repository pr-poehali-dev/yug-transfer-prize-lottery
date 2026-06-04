"""Общая логика бота @zacazubot: очередь, платежи ЮKassa, уведомления."""
import os
import json
import time
import uuid
import base64
import urllib.request
import urllib.error
from datetime import datetime, timedelta

SCHEMA = os.environ.get('MAIN_DB_SCHEMA') or 't_p67171637_yug_transfer_prize_l'
DEADLINE_MINUTES = 5
ACCEPT_BUTTON_TEXT = '✅ Принять заказ'


def bot_token() -> str:
    return (os.environ.get('ZACAZU_BOT_TOKEN_NEW', '')
            or os.environ.get('ZACAZU_BOT_TOKEN', '')
            or os.environ.get('TELEGRAM_BOT_TOKEN', ''))


def tg_call(method: str, payload: dict) -> dict:
    token = bot_token()
    if not token:
        return {'ok': False, 'description': 'ZACAZU_BOT_TOKEN не задан'}
    url = f"https://api.telegram.org/bot{token}/{method}"
    data = json.dumps(payload).encode()
    last_err = 'fail'
    # Короткий таймаут + 2 повтора, чтобы единичный зависший запрос не ломал обработку.
    for attempt in range(2):
        req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method='POST')
        try:
            with urllib.request.urlopen(req, timeout=6) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            try:
                return json.loads(e.read())
            except Exception:
                return {'ok': False, 'description': f'HTTP {e.code}'}
        except Exception as e:
            last_err = f'{type(e).__name__}: {str(e)[:200]}'
            if attempt < 1:
                time.sleep(1)
    return {'ok': False, 'description': last_err}


def tg_send(chat_id, text: str, reply_markup: dict = None) -> dict:
    payload = {'chat_id': chat_id, 'text': text, 'parse_mode': 'HTML', 'disable_web_page_preview': True}
    if reply_markup:
        payload['reply_markup'] = reply_markup
    return tg_call('sendMessage', payload)


def tg_answer_callback(callback_id: str, text: str = '', show_alert: bool = False) -> dict:
    return tg_call('answerCallbackQuery', {
        'callback_query_id': callback_id, 'text': text, 'show_alert': show_alert,
    })


def esc(v) -> str:
    s = '' if v is None else str(v)
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def mention(user_id, username: str, first_name: str) -> str:
    if username:
        return f'@{username}'
    name = first_name or f'id{user_id}'
    return f'<a href="tg://user?id={user_id}">{esc(name)}</a>'


# ─────────────────────── ЮKassa ───────────────────────

def yk_auth_header() -> str:
    shop = os.environ.get('YOOKASSA_SHOP_ID', '')
    key = os.environ.get('YOOKASSA_SECRET_KEY', '')
    raw = f'{shop}:{key}'.encode()
    return 'Basic ' + base64.b64encode(raw).decode()


def yk_create_payment(amount_rub: float, description: str, metadata: dict) -> dict:
    if not os.environ.get('YOOKASSA_SHOP_ID') or not os.environ.get('YOOKASSA_SECRET_KEY'):
        return {'ok': False, 'error': 'ЮKassa не настроена'}
    return_url = f'https://t.me/{os.environ.get("ZACAZU_BOT_USERNAME", "zacazubot")}'
    body = json.dumps({
        'amount': {'value': f'{amount_rub:.2f}', 'currency': 'RUB'},
        'capture': True,
        'confirmation': {'type': 'redirect', 'return_url': return_url},
        'description': description[:128],
        'metadata': metadata,
    }).encode()
    req = urllib.request.Request(
        'https://api.yookassa.ru/v3/payments', data=body, method='POST',
        headers={
            'Authorization': yk_auth_header(),
            'Idempotence-Key': str(uuid.uuid4()),
            'Content-Type': 'application/json',
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            j = json.loads(resp.read())
        url = (j.get('confirmation') or {}).get('confirmation_url')
        return {'ok': True, 'payment_id': j.get('id'), 'url': url}
    except urllib.error.HTTPError as e:
        try:
            err = json.loads(e.read())
            return {'ok': False, 'error': err.get('description', f'HTTP {e.code}')}
        except Exception:
            return {'ok': False, 'error': f'HTTP {e.code}'}
    except Exception as e:
        return {'ok': False, 'error': f'{type(e).__name__}: {str(e)[:200]}'}


# ─────────────────────── Подписка водителя ───────────────────────

SUB_PLANS = {
    'sub_1': (1, 1500, '1 месяц'),
    'sub_6': (6, 6000, '6 месяцев'),
    'sub_12': (12, 10000, '12 месяцев'),
}
SUB_COMMISSION_PCT = 10  # комиссия подписчика по любому заказу


def has_active_sub(cur, tg_user_id) -> bool:
    cur.execute(
        f"SELECT active_until FROM {SCHEMA}.driver_subs WHERE tg_user_id=%s",
        (tg_user_id,),
    )
    row = cur.fetchone()
    if not row:
        return False
    au = row['active_until'] if isinstance(row, dict) else row[0]
    return bool(au and au > datetime.utcnow())


def sub_active_until(cur, tg_user_id):
    cur.execute(
        f"SELECT active_until FROM {SCHEMA}.driver_subs WHERE tg_user_id=%s",
        (tg_user_id,),
    )
    row = cur.fetchone()
    if not row:
        return None
    return row['active_until'] if isinstance(row, dict) else row[0]


def parse_price(v) -> float:
    s = str(v or '').replace(',', '.')
    digits = ''.join(ch for ch in s if (ch.isdigit() or ch == '.'))
    try:
        return float(digits) if digits else 0.0
    except Exception:
        return 0.0


def commission_for(cur, o: dict, tg_user_id) -> float:
    """Комиссия за заказ: подписчику — 10% от цены, остальным — как в заказе."""
    if has_active_sub(cur, tg_user_id):
        return round(parse_price(o.get('price')) * SUB_COMMISSION_PCT / 100.0, 2)
    return float(o.get('commission_rub') or 0)


def extend_sub(cur, conn, tg_user_id, months: int, username='', first_name='', payment_id=''):
    """Продлевает подписку: от текущей даты окончания (если активна) или от сегодня."""
    base = sub_active_until(cur, tg_user_id)
    start = base if (base and base > datetime.utcnow()) else datetime.utcnow()
    new_until = start + timedelta(days=30 * months)
    cur.execute(
        f"INSERT INTO {SCHEMA}.driver_subs (tg_user_id, username, first_name, active_until, last_payment_id, updated_at) "
        f"VALUES (%s,%s,%s,%s,%s,NOW()) "
        f"ON CONFLICT (tg_user_id) DO UPDATE SET "
        f"active_until=EXCLUDED.active_until, username=EXCLUDED.username, "
        f"first_name=EXCLUDED.first_name, last_payment_id=EXCLUDED.last_payment_id, updated_at=NOW()",
        (tg_user_id, username or '', first_name or '', new_until, payment_id or ''),
    )
    conn.commit()
    return new_until


# ─────────────────────── Очередь ───────────────────────

def get_order(cur, order_id: int):
    cur.execute(
        f"SELECT id, from_city, to_city, from_address, to_address, order_date, order_time, "
        f"price, tariff, client_phone, people, luggage, comment, commission_rub, "
        f"tg_chat_id, tg_message_id, tg_message_text, sale_status, current_user_id, winner_user_id, "
        f"trip_status, winner_chat_id, winner_message_id "
        f"FROM {SCHEMA}.dispatch_orders WHERE id=%s", (order_id,)
    )
    return cur.fetchone()


def order_brief(o: dict) -> str:
    a = o.get('from_city') or o.get('from_address') or ''
    b = o.get('to_city') or o.get('to_address') or ''
    route = f'{a} → {b}'.strip(' →') or 'заказ'
    extra = []
    if o.get('order_date'):
        extra.append(o['order_date'])
    if o.get('price'):
        extra.append(f"{o['price']} ₽")
    return route + (f" ({', '.join(extra)})" if extra else '')


def order_public_text(o: dict) -> str:
    """Инфо о заказе ДО оплаты — без контактов клиента и точных адресов."""
    head = f"🔖 <b>Заказ #{o['id']}</b> — ИНФОРМАЦИЯ" if o.get('id') else '🚖 <b>ИНФОРМАЦИЯ О ЗАКАЗЕ</b>'
    lines = [head, '']
    if o.get('from_city'):
        lines.append(f"📍 <b>Откуда:</b> {esc(o['from_city'])}")
    if o.get('to_city'):
        lines.append(f"🏁 <b>Куда:</b> {esc(o['to_city'])}")
    if o.get('order_date'):
        lines.append(f"📅 <b>Дата:</b> {esc(o['order_date'])} {esc(o.get('order_time') or '')}".strip())
    if o.get('price'):
        lines.append(f"💰 <b>Стоимость:</b> {esc(o['price'])} ₽")
    if o.get('tariff'):
        lines.append(f"🎫 <b>Тариф:</b> {esc(o['tariff'])}")
    if o.get('commission_rub'):
        lines.append(f"💳 <b>Комиссия:</b> {float(o['commission_rub']):.0f} ₽")
    return '\n'.join(lines)


def queue_list(cur, order_id: int):
    cur.execute(
        f"SELECT tg_user_id, username, first_name, position, status FROM {SCHEMA}.order_queue "
        f"WHERE order_id=%s ORDER BY position ASC", (order_id,)
    )
    return cur.fetchall()


def render_queue_text(o: dict, queue: list) -> str:
    lines = [f'📋 <b>Очередь на заказ:</b> {order_brief(o)}', '']
    if not queue:
        lines.append('Очередь пуста.')
    for q in queue:
        m = mention(q['tg_user_id'], q['username'], q['first_name'])
        if q['status'] == 'paying':
            lines.append(f"⏳ {q['position']}. {m} — оплачивает ({DEADLINE_MINUTES} мин)")
        elif q['status'] == 'paid':
            lines.append(f"✅ {q['position']}. {m} — оплатил")
        else:
            lines.append(f"🔹 {q['position']}. {m}")
    return '\n'.join(lines)


def render_queue_block(queue: list) -> str:
    """Блок «Откликнувшиеся водители» для дописывания в сообщение заказа."""
    if not queue:
        return ''
    lines = ['', '━━━━━━━━━━━━━━━', '👥 <b>Откликнувшиеся водители:</b>']
    for q in queue:
        m = mention(q['tg_user_id'], q['username'], q['first_name'])
        if q['status'] == 'paying':
            tail = '— оплачивает 💳'
        elif q['status'] == 'paid':
            tail = '— оплатил ✅'
        elif q['status'] == 'expired':
            tail = '— не успел ⌛'
        else:
            tail = '— на рассмотрении'
        lines.append(f"{q['position']}. {m} {tail}")
    return '\n'.join(lines)


def contacts_block(o: dict, with_phone: bool = True) -> str:
    """Блок с контактами клиента, который ДОПИСЫВАЕТСЯ к тексту заказа (не заменяет его)."""
    lines = ['━━━━━━━━━━━━━━━', '🎉 <b>Заказ ваш! Контакты клиента:</b>', '']
    if with_phone:
        lines.append(f"📞 <b>Телефон:</b> {esc(o.get('client_phone') or '—')}")
    a = o.get('from_address')
    b = o.get('to_address')
    if a:
        lines.append(f"➡️ <b>Точный адрес подачи:</b> {esc(a)}")
    if b:
        lines.append(f"⬅️ <b>Точный адрес назначения:</b> {esc(b)}")
    if o.get('comment'):
        lines.append(f"💬 {esc(o['comment'])}")
    return '\n'.join(lines)


def client_contacts_text(o: dict, with_phone: bool = True, done: bool = False) -> str:
    head = '✅ <b>Заказ завершён</b>' if done else '🎉 <b>Заказ ваш! Контакты клиента:</b>'
    lines = [head, '']
    if with_phone:
        lines.append(f"📞 <b>Телефон:</b> {esc(o.get('client_phone') or '—')}")
    a = o.get('from_address') or o.get('from_city')
    b = o.get('to_address') or o.get('to_city')
    if a:
        lines.append(f"➡️ <b>Откуда:</b> {esc(a)}")
    if b:
        lines.append(f"⬅️ <b>Куда:</b> {esc(b)}")
    if o.get('order_date'):
        lines.append(f"📅 <b>Дата:</b> {esc(o['order_date'])} {esc(o.get('order_time') or '')}".strip())
    if o.get('people'):
        lines.append(f"👥 <b>Человек:</b> {esc(o['people'])}")
    if o.get('comment'):
        lines.append(f"💬 {esc(o['comment'])}")
    return '\n'.join(lines)


def deadline_dt():
    return datetime.utcnow() + timedelta(minutes=DEADLINE_MINUTES)