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
    cur.execute(f"SELECT username, first_name FROM {SCHEMA}.kb_subscriptions WHERE tg_user_id={int(uid)}")
    u = cur.fetchone() or ('', '')
    e = lambda v: str(v or '').replace("'", "''")
    cur.execute(f"INSERT INTO {SCHEMA}.kb_payments (tg_user_id, chat_id, username, first_name, amount_rub, days, "
                f"payment_id, status, plan, note) VALUES ({int(uid)}, {int(chat_id)}, '{e(u[0])}', '{e(u[1])}', "
                f"{plan['price']}, {plan['days']}, '{e(pid)}', 'pending', '{plan_key}', '{e(plan['title'])}')")
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
        cur.execute(f"SELECT tg_user_id, chat_id, plan, status, days FROM {SCHEMA}.kb_payments WHERE payment_id='{pid}'")
        row = cur.fetchone()
        if not row:
            return {'status': status or 'unknown'}
        uid, chat_id, plan_key, old, days = row
        res = {'status': status, 'chat_id': chat_id or uid, 'plan': plan_key, 'new': False, 'pid': pid}
        if status == 'succeeded' and p.get('paid'):
            cur.execute(f"UPDATE {SCHEMA}.kb_payments SET status='succeeded', paid_at=now(), created_at=now() "
                        f"WHERE payment_id='{pid}' AND status<>'succeeded' RETURNING id")
            if cur.fetchone():
                days = int(days or PLANS.get(plan_key, {}).get('days', 30))
                cur.execute(
                    f"INSERT INTO {SCHEMA}.kb_subscriptions (tg_user_id, active_until, is_trial) "
                    f"VALUES ({int(uid)}, now() + interval '{days} days', false) "
                    f"ON CONFLICT (tg_user_id) DO UPDATE SET is_trial=false, updated_at=now(), reminded_until=NULL, "
                    f"active_until=GREATEST(COALESCE({SCHEMA}.kb_subscriptions.active_until, now()), now()) + interval '{days} days'")
                cur.execute(f"UPDATE {SCHEMA}.kb_payments SET paid_until=(SELECT active_until FROM {SCHEMA}.kb_subscriptions "
                            f"WHERE tg_user_id={int(uid)}) WHERE payment_id='{pid}'")
                res['new'] = True
            cur.execute(f"SELECT active_until FROM {SCHEMA}.kb_subscriptions WHERE tg_user_id={int(uid)}")
            u = cur.fetchone()
            res['until'] = u[0].strftime('%d.%m.%Y') if u and u[0] else ''
        elif status == 'canceled' and old != 'canceled':
            cur.execute(f"UPDATE {SCHEMA}.kb_payments SET status='canceled' WHERE payment_id='{pid}'")
        conn.commit()
        return res
    finally:
        cur.close()
        conn.close()


def due_reminders() -> list:
    """Подписки, которые кончаются в ближайшие 3 дня и о которых ещё не напоминали (на этот срок)."""
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        cur.execute(f"SELECT tg_user_id, active_until, is_trial FROM {SCHEMA}.kb_subscriptions "
                    f"WHERE active_until > now() AND active_until < now() + interval '3 days' "
                    f"AND (reminded_until IS NULL OR reminded_until <> active_until) LIMIT 200")
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()


def mark_reminded(uid: int) -> None:
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    cur.execute(f"UPDATE {SCHEMA}.kb_subscriptions SET reminded_until=active_until WHERE tg_user_id={int(uid)}")
    conn.commit()
    cur.close()
    conn.close()


def unnotified(uid: int = 0) -> list:
    """Оплаченные платежи, о которых человеку ещё не удалось сообщить."""
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        who = f"AND p.tg_user_id={int(uid)} " if uid else ''
        cur.execute(f"SELECT p.payment_id, COALESCE(p.chat_id, p.tg_user_id), p.plan, s.active_until "
                    f"FROM {SCHEMA}.kb_payments p LEFT JOIN {SCHEMA}.kb_subscriptions s ON s.tg_user_id=p.tg_user_id "
                    f"WHERE p.status='succeeded' AND NOT p.notified {who}"
                    f"AND p.paid_at > now() - interval '3 days' ORDER BY p.id LIMIT 30")
        return [{'pid': r[0], 'chat_id': r[1], 'plan': r[2], 'new': True,
                 'until': r[3].strftime('%d.%m.%Y') if r[3] else ''} for r in cur.fetchall()]
    finally:
        cur.close()
        conn.close()


def mark_notified(pid: str) -> None:
    pid = ''.join(c for c in str(pid) if c.isalnum() or c == '-')
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    cur.execute(f"UPDATE {SCHEMA}.kb_payments SET notified=TRUE WHERE payment_id='{pid}'")
    conn.commit()
    cur.close()
    conn.close()
