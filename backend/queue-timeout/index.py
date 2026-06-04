"""Cron: проверяет таймаут оплаты (5 мин) и передаёт заказ следующему в очереди."""
import os
import json
import psycopg2
import psycopg2.extras

from lib import (
    SCHEMA, DEADLINE_MINUTES, tg_send, tg_call, yk_create_payment,
    get_order, queue_list, render_queue_text, order_brief, mention, deadline_dt,
)

ZACAZU_BOT_FUNCTION_URL = 'https://functions.poehali.dev/84e2bef2-8bf6-46b9-a156-ce877a6c3c98'


def db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def ensure_webhook():
    """Самовосстановление: если webhook бота не на нашу функцию — переставить."""
    try:
        info = tg_call('getWebhookInfo', {})
        cur_url = (info.get('result') or {}).get('url', '')
        if cur_url == ZACAZU_BOT_FUNCTION_URL:
            return
        tg_call('setWebhook', {
            'url': ZACAZU_BOT_FUNCTION_URL,
            'allowed_updates': ['message', 'callback_query'],
        })
    except Exception:
        pass


def update_queue_message(cur, order_id: int):
    o = get_order(cur, order_id)
    if not o or not o['tg_chat_id']:
        return
    queue = queue_list(cur, order_id)
    tg_send(o['tg_chat_id'], render_queue_text(dict(o), [dict(q) for q in queue]))


def offer_to_first(cur, conn, order_id: int) -> bool:
    o = get_order(cur, order_id)
    if not o or o['sale_status'] != 'selling':
        return False
    cur.execute(f"SELECT 1 FROM {SCHEMA}.order_queue WHERE order_id=%s AND status='paying'", (order_id,))
    if cur.fetchone():
        return False
    cur.execute(
        f"SELECT * FROM {SCHEMA}.order_queue WHERE order_id=%s AND status='waiting' "
        f"ORDER BY position ASC LIMIT 1", (order_id,)
    )
    nxt = cur.fetchone()
    if not nxt:
        # Очередь закончилась — закрываем продажу
        cur.execute(
            f"UPDATE {SCHEMA}.dispatch_orders SET current_user_id=NULL, current_deadline=NULL WHERE id=%s",
            (order_id,),
        )
        conn.commit()
        if o['tg_chat_id']:
            tg_send(o['tg_chat_id'], f"⌛ Очередь по заказу закончилась, никто не оплатил: {order_brief(dict(o))}")
        return False

    amount = float(o['commission_rub'] or 0)
    pay = yk_create_payment(
        amount, f'Комиссия за заказ #{order_id}: {order_brief(dict(o))}',
        {'order_id': str(order_id), 'tg_user_id': str(nxt['tg_user_id'])},
    )
    if not pay.get('ok') or not pay.get('url'):
        tg_send(nxt['tg_user_id'], f"⚠️ Не удалось создать оплату: {pay.get('error', 'ошибка')}.")
        return False

    cur.execute(
        f"UPDATE {SCHEMA}.order_queue SET status='paying', payment_id=%s, payment_url=%s WHERE id=%s",
        (pay['payment_id'], pay['url'], nxt['id']),
    )
    cur.execute(
        f"UPDATE {SCHEMA}.dispatch_orders SET current_user_id=%s, current_deadline=%s WHERE id=%s",
        (nxt['tg_user_id'], deadline_dt(), order_id),
    )
    conn.commit()
    tg_send(
        nxt['tg_user_id'],
        f"🚖 <b>Твоя очередь!</b>\nЗаказ: {order_brief(dict(o))}\n\n"
        f"💳 Оплати комиссию <b>{amount:.0f} ₽</b> в течение {DEADLINE_MINUTES} минут.",
        {'inline_keyboard': [[{'text': f'💳 Оплатить {amount:.0f} ₽', 'url': pay['url']}]]},
    )
    update_queue_message(cur, order_id)
    return True


def handler(event: dict, context) -> dict:
    """Cron-проверка просроченных оплат. Защита заголовком X-Cron-Secret."""
    cors = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    secret = os.environ.get('CRON_SECRET', '')
    headers = event.get('headers') or {}
    got = headers.get('X-Cron-Secret') or headers.get('x-cron-secret') or ''
    if secret and got != secret:
        return {'statusCode': 403, 'headers': cors, 'body': json.dumps({'ok': False, 'error': 'forbidden'})}

    # Самовосстановление webhook бота на каждом запуске cron.
    ensure_webhook()

    conn = db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    moved = 0
    try:
        cur.execute(
            f"SELECT id, current_user_id, tg_chat_id FROM {SCHEMA}.dispatch_orders "
            f"WHERE sale_status='selling' AND current_deadline IS NOT NULL "
            f"AND current_deadline < (NOW() AT TIME ZONE 'utc')"
        )
        expired = cur.fetchall()
        for o in expired:
            order_id = o['id']
            # Помечаем текущего как expired
            cur.execute(
                f"UPDATE {SCHEMA}.order_queue SET status='expired' "
                f"WHERE order_id=%s AND tg_user_id=%s AND status='paying'",
                (order_id, o['current_user_id']),
            )
            cur.execute(
                f"UPDATE {SCHEMA}.dispatch_orders SET current_user_id=NULL, current_deadline=NULL WHERE id=%s",
                (order_id,),
            )
            conn.commit()
            if o['current_user_id']:
                tg_send(o['current_user_id'], "⌛ Время на оплату вышло — заказ передан следующему.")
            offer_to_first(cur, conn, order_id)
            moved += 1
    finally:
        cur.close()
        conn.close()

    return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'ok': True, 'moved': moved})}