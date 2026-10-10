"""Оплата подписки через ЮKassa: тарифы, создание платежа, подтверждение и продление."""
import os
import json
import base64
import uuid
import urllib.request
import psycopg2

SCHEMA = 't_p67171637_yug_transfer_prize_l'
PLANS = {
    'm1': {'title': '1 месяц', 'price': 49, 'days': 30},
    'm6': {'title': '6 месяцев', 'price': 150, 'days': 182},
    'y1': {'title': '1 год', 'price': 300, 'days': 365},
}
PLANS_MARKUP = {'inline_keyboard': [
    [{'text': f"{p['title']} — {p['price']} ₽", 'callback_data': f'buy:{k}'}] for k, p in PLANS.items()]}


def _creds() -> tuple:
    shop = os.environ.get('YOOKASSA_SHOP_ID_NEW') or os.environ.get('YOOKASSA_SHOP_ID') or ''
    key = os.environ.get('YOOKASSA_SECRET_KEY_NEW') or os.environ.get('YOOKASSA_SECRET_KEY') or ''
    return shop.strip(), key.strip()


def _yk(method: str, path: str, data: dict = None) -> dict:
    shop, key = _creds()
    auth = base64.b64encode(f'{shop}:{key}'.encode()).decode()
    headers = {'Authorization': f'Basic {auth}', 'Content-Type': 'application/json'}
    if method == 'POST':
        headers['Idempotence-Key'] = str(uuid.uuid4())
    req = urllib.request.Request(f'https://api.yookassa.ru/v3/{path}', method=method, headers=headers,
                                 data=json.dumps(data).encode() if data is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=3.5) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        print(f'[KB-PAY] yookassa {e.code}: {e.read().decode()[:300]}')
    except Exception as e:
        print(f'[KB-PAY] yookassa failed: {type(e).__name__}: {e}')
    return {}


def create(uid: int, chat_id: int, plan_key: str, return_url: str) -> tuple:
    """Создаёт платёж, возвращает (ссылка на оплату, id платежа)."""
    plan = PLANS[plan_key]
    if not all(_creds()):
        return '', ''
    p = _yk('POST', 'payments', {
        'amount': {'value': f"{plan['price']}.00", 'currency': 'RUB'},
        'capture': True,
        'confirmation': {'type': 'redirect', 'return_url': return_url},
        'description': f"Подписка База Знаний — {plan['title']}",
        'metadata': {'tg_user_id': str(uid), 'chat_id': str(chat_id), 'plan': plan_key},
    })
    pid, url = p.get('id', ''), (p.get('confirmation') or {}).get('confirmation_url', '')
    if not pid or not url:
        return '', ''
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    cur.execute(f"INSERT INTO {SCHEMA}.kb_payments (id, tg_user_id, chat_id, plan, amount) "
                f"VALUES ('{pid.replace(chr(39), '')}', {int(uid)}, {int(chat_id)}, '{plan_key}', {plan['price']})")
    conn.commit()
    cur.close()
    conn.close()
    return url, pid


def confirm(payment_id: str) -> dict:
    """Сверяет платёж с ЮKassa и, если он оплачен, один раз продлевает подписку.
    Возвращает {'status': ..., 'chat_id', 'until', 'plan', 'new': bool}."""
    pid = ''.join(c for c in str(payment_id) if c.isalnum() or c == '-')
    p = _yk('GET', f'payments/{pid}') if pid else {}
    status = p.get('status', '')
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        cur.execute(f"SELECT tg_user_id, chat_id, plan, status FROM {SCHEMA}.kb_payments WHERE id='{pid}'")
        row = cur.fetchone()
        if not row:
            return {'status': status or 'unknown'}
        uid, chat_id, plan_key, old = row
        res = {'status': status, 'chat_id': chat_id, 'plan': plan_key, 'new': False}
        if status == 'succeeded' and p.get('paid'):
            cur.execute(f"UPDATE {SCHEMA}.kb_payments SET status='succeeded', paid_at=now() "
                        f"WHERE id='{pid}' AND status<>'succeeded' RETURNING id")
            if cur.fetchone():
                days = PLANS[plan_key]['days']
                cur.execute(
                    f"INSERT INTO {SCHEMA}.kb_subscriptions (tg_user_id, active_until, is_trial) "
                    f"VALUES ({int(uid)}, now() + interval '{days} days', false) "
                    f"ON CONFLICT (tg_user_id) DO UPDATE SET is_trial=false, updated_at=now(), "
                    f"active_until=GREATEST(COALESCE({SCHEMA}.kb_subscriptions.active_until, now()), now()) + interval '{days} days'")
                res['new'] = True
            cur.execute(f"SELECT active_until FROM {SCHEMA}.kb_subscriptions WHERE tg_user_id={int(uid)}")
            u = cur.fetchone()
            res['until'] = u[0].strftime('%d.%m.%Y') if u and u[0] else ''
        elif status == 'canceled' and old != 'canceled':
            cur.execute(f"UPDATE {SCHEMA}.kb_payments SET status='canceled' WHERE id='{pid}'")
        conn.commit()
        return res
    finally:
        cur.close()
        conn.close()
