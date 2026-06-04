"""Бот @zacazubot: приём заказов в очередь, оплата комиссии через ЮKassa."""
import os
import json
import psycopg2
import psycopg2.extras

from lib import (
    SCHEMA, DEADLINE_MINUTES, tg_send, tg_answer_callback, tg_call,
    yk_create_payment, get_order, queue_list, render_queue_text,
    client_contacts_text, order_brief, mention, deadline_dt,
)


def db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def offer_to_first(cur, conn, order_id: int):
    """Назначает оплату первому в очереди (status waiting->paying) и шлёт ему ссылку."""
    o = get_order(cur, order_id)
    if not o or o['sale_status'] not in ('selling',):
        return
    # Уже есть кто-то оплачивающий?
    cur.execute(
        f"SELECT * FROM {SCHEMA}.order_queue WHERE order_id=%s AND status='paying' LIMIT 1", (order_id,)
    )
    if cur.fetchone():
        return
    cur.execute(
        f"SELECT * FROM {SCHEMA}.order_queue WHERE order_id=%s AND status='waiting' "
        f"ORDER BY position ASC LIMIT 1", (order_id,)
    )
    nxt = cur.fetchone()
    if not nxt:
        return

    amount = float(o['commission_rub'] or 0)
    if amount <= 0:
        # Нет комиссии — сразу отдаём заказ
        award_order(cur, conn, order_id, nxt)
        return

    pay = yk_create_payment(
        amount, f'Комиссия за заказ #{order_id}: {order_brief(o)}',
        {'order_id': str(order_id), 'tg_user_id': str(nxt['tg_user_id'])},
    )
    if not pay.get('ok') or not pay.get('url'):
        tg_send(nxt['tg_user_id'], f"⚠️ Не удалось создать оплату: {pay.get('error', 'ошибка')}. Попробуй позже.")
        return

    cur.execute(
        f"UPDATE {SCHEMA}.order_queue SET status='paying', payment_id=%s WHERE id=%s",
        (pay['payment_id'], nxt['id']),
    )
    cur.execute(
        f"UPDATE {SCHEMA}.dispatch_orders SET current_user_id=%s, current_deadline=%s WHERE id=%s",
        (nxt['tg_user_id'], deadline_dt(), order_id),
    )
    conn.commit()

    tg_send(
        nxt['tg_user_id'],
        f"🚖 <b>Твоя очередь!</b>\nЗаказ: {order_brief(o)}\n\n"
        f"💳 Оплати комиссию <b>{amount:.0f} ₽</b> в течение {DEADLINE_MINUTES} минут, "
        f"иначе заказ перейдёт следующему.",
        {'inline_keyboard': [[{'text': f'💳 Оплатить {amount:.0f} ₽', 'url': pay['url']}]]},
    )
    update_queue_message(cur, conn, order_id)


def award_order(cur, conn, order_id: int, winner: dict):
    """Победитель определён: отдаём контакты, закрываем заказ."""
    o = get_order(cur, order_id)
    cur.execute(
        f"UPDATE {SCHEMA}.order_queue SET status='paid' WHERE order_id=%s AND tg_user_id=%s",
        (order_id, winner['tg_user_id']),
    )
    cur.execute(
        f"UPDATE {SCHEMA}.dispatch_orders SET sale_status='sold', winner_user_id=%s, "
        f"current_user_id=NULL, current_deadline=NULL WHERE id=%s",
        (winner['tg_user_id'], order_id),
    )
    conn.commit()

    tg_send(winner['tg_user_id'], client_contacts_text(dict(o)))

    # Обновляем сообщение в группе: заказ куплен, убираем кнопку
    if o['tg_chat_id'] and o.get('current_user_id') is not None or o['tg_chat_id']:
        cur.execute(f"SELECT tg_message_id FROM {SCHEMA}.dispatch_orders WHERE id=%s", (order_id,))
        row = cur.fetchone()
        msg_id = row['tg_message_id'] if row else None
        m = mention(winner['tg_user_id'], winner['username'], winner['first_name'])
        if msg_id:
            tg_call('editMessageReplyMarkup', {
                'chat_id': o['tg_chat_id'], 'message_id': msg_id, 'reply_markup': {'inline_keyboard': []},
            })
        tg_send(o['tg_chat_id'], f"✅ Заказ куплен: {m}\n{order_brief(dict(o))}")


def update_queue_message(cur, conn, order_id: int):
    """Шлёт в группу отдельное сообщение с текущей очередью."""
    o = get_order(cur, order_id)
    if not o or not o['tg_chat_id']:
        return
    queue = queue_list(cur, order_id)
    tg_send(o['tg_chat_id'], render_queue_text(dict(o), [dict(q) for q in queue]))


def handle_accept(cur, conn, order_id: int, user: dict, callback_id: str):
    o = get_order(cur, order_id)
    if not o:
        tg_answer_callback(callback_id, 'Заказ не найден', True)
        return
    if o['sale_status'] != 'selling':
        tg_answer_callback(callback_id, 'Заказ уже куплен или закрыт', True)
        return

    cur.execute(
        f"SELECT id, status FROM {SCHEMA}.order_queue WHERE order_id=%s AND tg_user_id=%s",
        (order_id, user['id']),
    )
    existing = cur.fetchone()
    if existing:
        tg_answer_callback(callback_id, 'Ты уже в очереди', False)
        return

    cur.execute(
        f"SELECT COALESCE(MAX(position),0)+1 AS pos FROM {SCHEMA}.order_queue WHERE order_id=%s",
        (order_id,),
    )
    pos = cur.fetchone()['pos']
    cur.execute(
        f"INSERT INTO {SCHEMA}.order_queue (order_id, tg_user_id, username, first_name, position, status) "
        f"VALUES (%s,%s,%s,%s,%s,'waiting')",
        (order_id, user['id'], user.get('username', '') or '', user.get('first_name', '') or '', pos),
    )
    conn.commit()
    tg_answer_callback(callback_id, f'Ты в очереди, место {pos}', False)
    update_queue_message(cur, conn, order_id)
    offer_to_first(cur, conn, order_id)


def handle_telegram(update: dict):
    conn = db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        cb = update.get('callback_query')
        if cb:
            data = cb.get('data', '')
            user = cb.get('from', {})
            if data.startswith('accept:'):
                try:
                    order_id = int(data.split(':', 1)[1])
                except Exception:
                    tg_answer_callback(cb['id'], 'Ошибка', True)
                    return
                handle_accept(cur, conn, order_id, user, cb['id'])
            else:
                tg_answer_callback(cb['id'])
            return

        msg = update.get('message')
        if msg:
            chat = msg.get('chat', {})
            chat_type = chat.get('type', '')
            text = msg.get('text') or ''
            # В группе по команде /id показываем её ID — чтобы вписать в DISPATCH_CHAT_ID.
            if chat_type in ('group', 'supergroup') and text.startswith('/id'):
                tg_send(chat['id'], f"🆔 ID этой группы: <code>{chat['id']}</code>")
            elif text.startswith('/start'):
                tg_send(chat['id'],
                        "👋 Это бот заказов. Принимай заказы в группе кнопкой «✅ Принять заказ» "
                        "и оплачивай комиссию здесь.")
    finally:
        cur.close()
        conn.close()


def handle_yookassa(body: dict):
    """Webhook ЮKassa: при успешной оплате отдаём контакты победителю."""
    event = body.get('event', '')
    obj = body.get('object', {})
    payment_id = obj.get('id', '')
    if event != 'payment.succeeded' or not payment_id:
        return
    conn = db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        cur.execute(
            f"SELECT * FROM {SCHEMA}.order_queue WHERE payment_id=%s AND status='paying' LIMIT 1",
            (payment_id,),
        )
        q = cur.fetchone()
        if not q:
            return
        order_id = q['order_id']
        o = get_order(cur, order_id)
        if o and o['sale_status'] == 'selling':
            award_order(cur, conn, order_id, dict(q))
    finally:
        cur.close()
        conn.close()


def handler(event: dict, context) -> dict:
    """Webhook бота @zacazubot (Telegram) и ЮKassa (?yookassa=1)."""
    cors = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    if event.get('httpMethod') != 'POST':
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'ok': True})}

    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'ok': True})}

    qs = event.get('queryStringParameters') or {}

    # Настройка webhook Telegram: ?setup=1, в body {"url": "<url этой функции>"}.
    if qs.get('setup'):
        self_url = body.get('url') or ''
        if not self_url:
            return {'statusCode': 400, 'headers': cors,
                    'body': json.dumps({'ok': False, 'error': 'Передай url функции в body'})}
        res = tg_call('setWebhook', {'url': self_url, 'allowed_updates': ['message', 'callback_query']})
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps(res)}

    try:
        if qs.get('yookassa'):
            handle_yookassa(body)
        else:
            handle_telegram(body)
    except Exception as e:
        print(f'handler error: {e}')

    return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'ok': True})}