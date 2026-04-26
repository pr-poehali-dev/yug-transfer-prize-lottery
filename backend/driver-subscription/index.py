"""
Business: Telegram-бот @zacazubot для подписок водителей. Принимает /start, показывает тарифы, обрабатывает оплату через Telegram Payments (ЮKassa). Пишет статус подписки в БД.
Args: event с httpMethod, body (Telegram update JSON)
Returns: {ok: True} для Telegram webhook
"""
import json
import os
import urllib.request
import urllib.parse
from datetime import datetime, timedelta
import psycopg2

BOT_TOKEN = os.environ.get('DRIVER_BOT_TOKEN', '')
PROVIDER_TOKEN = os.environ.get('YUKASSA_PROVIDER_TOKEN', '')
DB_URL = os.environ.get('DATABASE_URL', '')

PLANS = {
    'month': {'title': 'Подписка на месяц', 'amount': 1000, 'days': 30, 'label': 'Месяц — 1000₽'},
    'half':  {'title': 'Подписка на полгода', 'amount': 5000, 'days': 182, 'label': 'Полгода — 5000₽'},
    'year':  {'title': 'Подписка на год', 'amount': 9000, 'days': 365, 'label': 'Год — 9000₽'},
}

WELCOME = (
    "Привет! Это бот подписки для водителей Transfer Zone VIP.\n\n"
    "С активной подпиской комиссия по заказам — 10% (вместо 15%).\n\n"
    "Выберите тариф:"
)


def tg_api(method: str, payload: dict) -> dict:
    if not BOT_TOKEN:
        return {'ok': False, 'error': 'no_token'}
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/{method}"
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read().decode('utf-8'))
    except Exception as e:
        return {'ok': False, 'error': str(e)}


def send_plans(chat_id: int) -> None:
    keyboard = [
        [{'text': PLANS['month']['label'], 'callback_data': 'pay_month'}],
        [{'text': PLANS['half']['label'], 'callback_data': 'pay_half'}],
        [{'text': PLANS['year']['label'], 'callback_data': 'pay_year'}],
        [{'text': 'Моя подписка', 'callback_data': 'status'}],
    ]
    tg_api('sendMessage', {
        'chat_id': chat_id,
        'text': WELCOME,
        'reply_markup': {'inline_keyboard': keyboard},
    })


def send_invoice(chat_id: int, plan_key: str) -> None:
    plan = PLANS[plan_key]
    if not PROVIDER_TOKEN:
        tg_api('sendMessage', {
            'chat_id': chat_id,
            'text': f"⚠️ Оплата временно в режиме настройки.\n\nТариф: {plan['label']}\n\nПопробуйте позже — оплата подключается.",
        })
        return
    tg_api('sendInvoice', {
        'chat_id': chat_id,
        'title': plan['title'],
        'description': f"Подписка водителя Transfer Zone VIP. Комиссия 10% вместо 15% на {plan['days']} дней.",
        'payload': f"sub_{plan_key}",
        'provider_token': PROVIDER_TOKEN,
        'currency': 'RUB',
        'prices': [{'label': plan['label'], 'amount': plan['amount'] * 100}],
        'need_email': False,
        'send_email_to_provider': False,
    })


def get_status(telegram_id: int) -> str:
    conn = psycopg2.connect(DB_URL)
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT plan, expires_at, status FROM driver_subscriptions WHERE telegram_id = %s ORDER BY id DESC LIMIT 1",
            (telegram_id,),
        )
        row = cur.fetchone()
        if not row:
            return "У вас пока нет подписки. Выберите тариф в /start."
        plan, expires_at, status = row
        plan_label = PLANS.get(plan, {}).get('label', plan)
        if status == 'active' and expires_at > datetime.utcnow():
            days_left = (expires_at - datetime.utcnow()).days
            return f"✅ Подписка активна\nТариф: {plan_label}\nДействует до: {expires_at.strftime('%d.%m.%Y')}\nОсталось дней: {days_left}"
        return f"❌ Подписка закончилась {expires_at.strftime('%d.%m.%Y')}.\nОформите новую через /start."
    finally:
        conn.close()


def save_subscription(telegram_id: int, username: str, first_name: str, plan_key: str, payment_id: str) -> None:
    plan = PLANS[plan_key]
    expires_at = datetime.utcnow() + timedelta(days=plan['days'])
    conn = psycopg2.connect(DB_URL)
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO driver_subscriptions (telegram_id, username, first_name, plan, amount_rub, started_at, expires_at, status, payment_id, reminder_3d_sent, expired_notify_sent)
            VALUES (%s, %s, %s, %s, %s, NOW(), %s, 'active', %s, FALSE, FALSE)
            ON CONFLICT (telegram_id) DO UPDATE SET
                username = EXCLUDED.username,
                first_name = EXCLUDED.first_name,
                plan = EXCLUDED.plan,
                amount_rub = EXCLUDED.amount_rub,
                started_at = NOW(),
                expires_at = EXCLUDED.expires_at,
                status = 'active',
                payment_id = EXCLUDED.payment_id,
                reminder_3d_sent = FALSE,
                expired_notify_sent = FALSE,
                updated_at = NOW()
        """, (telegram_id, username or '', first_name or '', plan_key, plan['amount'], expires_at, payment_id))
        cur.execute("""
            INSERT INTO driver_subscription_payments (telegram_id, plan, amount_rub, payment_id, status)
            VALUES (%s, %s, %s, %s, 'success')
        """, (telegram_id, plan_key, plan['amount'], payment_id))
        conn.commit()
    finally:
        conn.close()


def handler(event: dict, context) -> dict:
    method = event.get('httpMethod', 'POST')
    headers = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type'}
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': headers, 'body': ''}
    if method == 'GET':
        return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'ok': True, 'bot': '@zacazubot'})}

    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'ok': True})}

    if 'message' in body:
        msg = body['message']
        chat_id = msg['chat']['id']
        text = msg.get('text', '')
        if text.startswith('/start'):
            send_plans(chat_id)
        elif text.startswith('/status'):
            tg_api('sendMessage', {'chat_id': chat_id, 'text': get_status(chat_id)})
        elif 'successful_payment' in msg:
            sp = msg['successful_payment']
            payload = sp.get('invoice_payload', '')
            plan_key = payload.replace('sub_', '')
            if plan_key in PLANS:
                user = msg.get('from', {})
                save_subscription(
                    chat_id,
                    user.get('username', ''),
                    user.get('first_name', ''),
                    plan_key,
                    sp.get('telegram_payment_charge_id', ''),
                )
                tg_api('sendMessage', {
                    'chat_id': chat_id,
                    'text': f"✅ Оплата получена! Подписка активна.\n\n{get_status(chat_id)}",
                })

    elif 'callback_query' in body:
        cq = body['callback_query']
        chat_id = cq['message']['chat']['id']
        data = cq.get('data', '')
        tg_api('answerCallbackQuery', {'callback_query_id': cq['id']})
        if data.startswith('pay_'):
            plan_key = data.replace('pay_', '')
            if plan_key in PLANS:
                send_invoice(chat_id, plan_key)
        elif data == 'status':
            tg_api('sendMessage', {'chat_id': chat_id, 'text': get_status(chat_id)})

    elif 'pre_checkout_query' in body:
        pcq = body['pre_checkout_query']
        tg_api('answerPreCheckoutQuery', {'pre_checkout_query_id': pcq['id'], 'ok': True})

    return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'ok': True})}
