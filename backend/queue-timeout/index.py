"""Cron: проверяет таймаут оплаты (5 мин) и передаёт заказ следующему в очереди."""
import os
import json
import psycopg2
import psycopg2.extras
from datetime import datetime

from lib import (
    SCHEMA, DEADLINE_MINUTES, tg_send, tg_call, yk_create_payment,
    get_order, queue_list, render_queue_text, render_queue_block, order_public_text,
    order_brief, mention, deadline_dt, mark_order_message,
)

ZACAZU_BOT_FUNCTION_URL = 'https://functions.poehali.dev/84e2bef2-8bf6-46b9-a156-ce877a6c3c98'
BOT_USERNAME = os.environ.get('ZACAZU_BOT_USERNAME', 'zacazubot')


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
    """Редактирует исходное сообщение заказа в группе: обновляет список откликнувшихся."""
    o = get_order(cur, order_id)
    if not o or not o['tg_chat_id'] or not o.get('tg_message_id'):
        return
    queue = [dict(q) for q in queue_list(cur, order_id)]
    base = o.get('tg_message_text') or order_public_text(dict(o))
    text = base + render_queue_block(queue)
    btn = {'text': '✅ Принять заказ',
           'url': f'https://t.me/{BOT_USERNAME}?start=accept_{order_id}'}
    tg_call('editMessageText', {
        'chat_id': o['tg_chat_id'], 'message_id': o['tg_message_id'],
        'text': text, 'parse_mode': 'HTML', 'disable_web_page_preview': True,
        'reply_markup': {'inline_keyboard': [[btn]]},
    })


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
        # Очередь закончилась, никто не оплатил → статус «Нет машин / Отмена».
        cur.execute(
            f"UPDATE {SCHEMA}.dispatch_orders SET sale_status='no_cars', "
            f"current_user_id=NULL, current_deadline=NULL WHERE id=%s",
            (order_id,),
        )
        conn.commit()
        mark_order_message(dict(o), '❌ <b>Нет машин — заказ отменён</b>')
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
    reminded = 0
    try:
        cur.execute(
            f"SELECT id, current_user_id, tg_chat_id FROM {SCHEMA}.dispatch_orders "
            f"WHERE sale_status='selling' AND current_deadline IS NOT NULL "
            f"AND current_deadline < (NOW() AT TIME ZONE 'utc')"
        )
        expired = cur.fetchall()
        for o in expired:
            order_id = o['id']
            # Не успел оплатить — УБИРАЕМ из очереди, чтобы мог встать заново.
            cur.execute(
                f"DELETE FROM {SCHEMA}.order_queue "
                f"WHERE order_id=%s AND tg_user_id=%s AND status='paying'",
                (order_id, o['current_user_id']),
            )
            cur.execute(
                f"UPDATE {SCHEMA}.dispatch_orders SET current_user_id=NULL, current_deadline=NULL WHERE id=%s",
                (order_id,),
            )
            conn.commit()
            if o['current_user_id']:
                tg_send(o['current_user_id'],
                        "⌛ Время на оплату вышло — заказ передан следующему.\n"
                        "Если заказ ещё открыт, можешь снова нажать «Принять заказ».")
            # Сразу убираем неоплатившего из списка в сообщении заказа.
            update_queue_message(cur, order_id)
            offer_to_first(cur, conn, order_id)
            moved += 1

        reminded = send_sub_reminders(cur, conn)
    finally:
        cur.close()
        conn.close()

    return {'statusCode': 200, 'headers': cors,
            'body': json.dumps({'ok': True, 'moved': moved, 'reminded': reminded})}


def send_sub_reminders(cur, conn) -> int:
    """Напоминание о продлении подписки за 3 дня до окончания (один раз за период)."""
    cur.execute(
        f"SELECT tg_user_id, active_until FROM {SCHEMA}.driver_subs "
        f"WHERE active_until IS NOT NULL "
        f"AND active_until > NOW() "
        f"AND active_until <= NOW() + INTERVAL '3 days' "
        f"AND (reminder_sent_for IS NULL OR reminder_sent_for <> active_until)"
    )
    rows = cur.fetchall()
    sent = 0
    for r in rows:
        uid = r['tg_user_id']
        until = r['active_until']
        days = max(1, (until - datetime.utcnow()).days)
        tg_send(uid,
                f"⏳ <b>Подписка скоро закончится</b>\n"
                f"Действует до <b>{until.strftime('%d.%m.%Y')}</b> (осталось ~{days} дн.)\n\n"
                f"Продлите подписку кнопками внизу, чтобы и дальше платить комиссию <b>10%</b>.")
        cur.execute(
            f"UPDATE {SCHEMA}.driver_subs SET reminder_sent_for=%s WHERE tg_user_id=%s",
            (until, uid),
        )
        conn.commit()
        sent += 1
    return sent