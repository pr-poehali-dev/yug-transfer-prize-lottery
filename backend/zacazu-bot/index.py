"""Бот @zacazubot: приём заказов в очередь, оплата комиссии через ЮKassa."""
import os
import json
import psycopg2
import psycopg2.extras

from lib import (
    SCHEMA, DEADLINE_MINUTES, tg_send, tg_answer_callback, tg_call,
    yk_create_payment, get_order, queue_list, render_queue_text, render_queue_block,
    client_contacts_text, order_brief, order_public_text, mention, deadline_dt,
)

BOT_USERNAME = os.environ.get('ZACAZU_BOT_USERNAME', 'zacazubot')


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

    yk_ready = bool(os.environ.get('YOOKASSA_SHOP_ID') and os.environ.get('YOOKASSA_SECRET_KEY'))

    # ТЕСТОВЫЙ РЕЖИМ: ЮKassa не настроена — даём кнопку «Я оплатил (тест)».
    if not yk_ready:
        cur.execute(
            f"UPDATE {SCHEMA}.order_queue SET status='paying', payment_id='TEST' WHERE id=%s",
            (nxt['id'],),
        )
        cur.execute(
            f"UPDATE {SCHEMA}.dispatch_orders SET current_user_id=%s, current_deadline=%s WHERE id=%s",
            (nxt['tg_user_id'], deadline_dt(), order_id),
        )
        conn.commit()
        tg_send(
            nxt['tg_user_id'],
            order_public_text(dict(o)) + '\n\n'
            f"🧪 Тестовый режим (ЮKassa ещё не подключена). Комиссия была бы <b>{amount:.0f} ₽</b>.\n"
            f"Нажми кнопку ниже, чтобы сымитировать оплату ({DEADLINE_MINUTES} мин).",
            {'inline_keyboard': [[{'text': f'✅ Я оплатил (тест)', 'callback_data': f'paid:{order_id}'}]]},
        )
        update_queue_message(cur, conn, order_id)
        return

    pay = yk_create_payment(
        amount, f'Комиссия за заказ #{order_id}: {order_brief(o)}',
        {'order_id': str(order_id), 'tg_user_id': str(nxt['tg_user_id'])},
    )
    if not pay.get('ok') or not pay.get('url'):
        tg_send(nxt['tg_user_id'], f"⚠️ Не удалось создать оплату: {pay.get('error', 'ошибка')}. Попробуй позже.")
        return

    cur.execute(
        f"UPDATE {SCHEMA}.order_queue SET status='paying', payment_id=%s, payment_url=%s WHERE id=%s",
        (pay['payment_id'], pay['url'], nxt['id']),
    )
    cur.execute(
        f"UPDATE {SCHEMA}.dispatch_orders SET current_user_id=%s, current_deadline=%s WHERE id=%s",
        (nxt['tg_user_id'], deadline_dt(), order_id),
    )
    conn.commit()

    send_payment_message(nxt['tg_user_id'], dict(o), amount, pay['url'])
    update_queue_message(cur, conn, order_id)


def send_payment_message(user_id, order: dict, amount: float, pay_url: str):
    """Отправляет водителю инфо о заказе и кнопку оплаты комиссии."""
    tg_send(
        user_id,
        order_public_text(order) + '\n\n'
        f"💳 Оплати комиссию <b>{amount:.0f} ₽</b> в течение {DEADLINE_MINUTES} минут.\n"
        f"После оплаты пришлю контакты клиента.",
        {'inline_keyboard': [[{'text': f'💳 Оплатить {amount:.0f} ₽', 'url': pay_url}]]},
    )


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

    # Контакты победителю + первая кнопка статуса «Клиент в машине».
    res = tg_send(
        winner['tg_user_id'],
        client_contacts_text(dict(o)),
        {'inline_keyboard': [[{'text': '🚗 Клиент в машине', 'callback_data': f'trip_pickup:{order_id}'}]]},
    )
    win_msg_id = (res.get('result') or {}).get('message_id')
    cur.execute(
        f"UPDATE {SCHEMA}.dispatch_orders SET trip_status='waiting_pickup', "
        f"winner_chat_id=%s, winner_message_id=%s WHERE id=%s",
        (winner['tg_user_id'], win_msg_id, order_id),
    )
    conn.commit()

    # Обновляем сообщение заказа в группе: оставляем только победителя, убираем кнопку и очередь.
    if o['tg_chat_id'] and o.get('tg_message_id'):
        m = mention(winner['tg_user_id'], winner['username'], winner['first_name'])
        base = o.get('tg_message_text') or order_public_text(dict(o))
        text = base + f"\n\n━━━━━━━━━━━━━━━\n✅ <b>Заказ отдан:</b> {m}"
        tg_call('editMessageText', {
            'chat_id': o['tg_chat_id'], 'message_id': o['tg_message_id'],
            'text': text, 'parse_mode': 'HTML', 'disable_web_page_preview': True,
            'reply_markup': {'inline_keyboard': []},
        })


def update_queue_message(cur, conn, order_id: int):
    """Редактирует сообщение заказа в группе: дописывает список очереди под заказом."""
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


def _notify(callback_id, user_id, text: str, alert: bool = False):
    """Отвечает на callback (если есть) либо пишет в личку (диплинк)."""
    if callback_id:
        tg_answer_callback(callback_id, text, alert)
    elif user_id:
        tg_send(user_id, text)


def handle_accept(cur, conn, order_id: int, user: dict, callback_id: str):
    uid = user.get('id')
    o = get_order(cur, order_id)
    if not o:
        _notify(callback_id, uid, 'Заказ не найден', True)
        return
    if o['sale_status'] != 'selling':
        _notify(callback_id, uid, 'Заказ уже куплен или закрыт', True)
        return

    cur.execute(
        f"SELECT id, status, payment_url FROM {SCHEMA}.order_queue WHERE order_id=%s AND tg_user_id=%s",
        (order_id, uid),
    )
    existing = cur.fetchone()
    if existing:
        # Водитель уже в очереди (повторный переход в бота).
        if existing['status'] == 'paying':
            # Он оплачивает сейчас — заново показываем кнопку оплаты (без лишних слов).
            url = existing.get('payment_url')
            amount = float(o['commission_rub'] or 0)
            if url:
                send_payment_message(uid, dict(o), amount, url)
            else:
                offer_to_first(cur, conn, order_id)
        else:
            # Ждёт своей очереди — на callback тихо подсказываем, в личку НЕ спамим.
            if callback_id:
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
        (order_id, uid, user.get('username', '') or '', user.get('first_name', '') or '', pos),
    )
    conn.commit()
    if callback_id:
        tg_answer_callback(callback_id, f'Ты в очереди, место {pos}', False)
    # Только не-первому шлём короткое уведомление о месте (первому сразу придёт оплата).
    if pos > 1:
        tg_send(uid, f"⏳ Ты в очереди на заказ, место <b>{pos}</b>.\n"
                     f"Если впереди стоящие не оплатят за {DEADLINE_MINUTES} мин — очередь дойдёт до тебя.")
    update_queue_message(cur, conn, order_id)
    offer_to_first(cur, conn, order_id)


def handle_test_paid(cur, conn, order_id: int, user: dict, callback_id: str):
    """Тестовая имитация оплаты: только текущий плательщик может нажать."""
    o = get_order(cur, order_id)
    if not o or o['sale_status'] != 'selling':
        tg_answer_callback(callback_id, 'Заказ уже закрыт', True)
        return
    cur.execute(
        f"SELECT * FROM {SCHEMA}.order_queue WHERE order_id=%s AND tg_user_id=%s AND status='paying' LIMIT 1",
        (order_id, user['id']),
    )
    q = cur.fetchone()
    if not q:
        tg_answer_callback(callback_id, 'Сейчас не твоя очередь оплачивать', True)
        return
    tg_answer_callback(callback_id, 'Оплата принята (тест)', False)
    award_order(cur, conn, order_id, dict(q))


def handle_trip_status(cur, conn, order_id: int, user: dict, callback_id: str, step: str):
    """Кнопки статуса поездки у победителя: pickup → done."""
    o = get_order(cur, order_id)
    if not o:
        tg_answer_callback(callback_id, 'Заказ не найден', True)
        return
    # Только победитель может менять статус.
    if o['winner_user_id'] != user['id']:
        tg_answer_callback(callback_id, 'Это не твой заказ', True)
        return

    win_chat = o['winner_chat_id']
    win_msg = o['winner_message_id']

    if step == 'pickup':
        if o['trip_status'] != 'waiting_pickup':
            tg_answer_callback(callback_id, 'Статус уже изменён', False)
            return
        cur.execute(
            f"UPDATE {SCHEMA}.dispatch_orders SET trip_status='in_progress' WHERE id=%s", (order_id,)
        )
        conn.commit()
        tg_answer_callback(callback_id, 'Клиент в машине', False)
        # Показываем вторую кнопку «Завершил заказ» (номер ещё виден).
        if win_chat and win_msg:
            tg_call('editMessageText', {
                'chat_id': win_chat, 'message_id': win_msg,
                'text': client_contacts_text(dict(o), with_phone=True) + '\n\n🚗 <b>Клиент в машине</b>',
                'parse_mode': 'HTML', 'disable_web_page_preview': True,
                'reply_markup': {'inline_keyboard': [[
                    {'text': '✅ Завершил заказ', 'callback_data': f'trip_done:{order_id}'}
                ]]},
            })
        return

    # step == 'done'
    if o['trip_status'] == 'done':
        tg_answer_callback(callback_id, 'Заказ уже завершён', False)
        return
    cur.execute(
        f"UPDATE {SCHEMA}.dispatch_orders SET trip_status='done' WHERE id=%s", (order_id,)
    )
    conn.commit()
    tg_answer_callback(callback_id, 'Заказ завершён', False)
    # Завершён — убираем номер клиента и кнопки.
    if win_chat and win_msg:
        tg_call('editMessageText', {
            'chat_id': win_chat, 'message_id': win_msg,
            'text': client_contacts_text(dict(o), with_phone=False, done=True),
            'parse_mode': 'HTML', 'disable_web_page_preview': True,
            'reply_markup': {'inline_keyboard': []},
        })


def handle_telegram(update: dict):
    conn = db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        cb = update.get('callback_query')
        if cb:
            data = cb.get('data', '')
            user = cb.get('from', {})
            print(f"callback received: data={data} user={user.get('id')}")
            if data.startswith('accept:'):
                try:
                    order_id = int(data.split(':', 1)[1])
                except Exception:
                    tg_answer_callback(cb['id'], 'Ошибка', True)
                    return
                handle_accept(cur, conn, order_id, user, cb['id'])
            elif data.startswith('paid:'):
                # Тестовая имитация оплаты.
                try:
                    order_id = int(data.split(':', 1)[1])
                except Exception:
                    tg_answer_callback(cb['id'], 'Ошибка', True)
                    return
                handle_test_paid(cur, conn, order_id, user, cb['id'])
            elif data.startswith('trip_pickup:') or data.startswith('trip_done:'):
                try:
                    order_id = int(data.split(':', 1)[1])
                except Exception:
                    tg_answer_callback(cb['id'], 'Ошибка', True)
                    return
                handle_trip_status(cur, conn, order_id, user, cb['id'],
                                   'pickup' if data.startswith('trip_pickup:') else 'done')
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
                # Диплинк из группы: /start accept_<order_id> — сразу в очередь.
                parts = text.split(maxsplit=1)
                arg = parts[1].strip() if len(parts) > 1 else ''
                if arg.startswith('accept_'):
                    try:
                        order_id = int(arg.split('accept_', 1)[1])
                    except Exception:
                        order_id = 0
                    if order_id:
                        user = msg.get('from', {})
                        handle_accept(cur, conn, order_id, user, None)
                        return
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

    qs0 = event.get('queryStringParameters') or {}
    # Диагностика webhook: GET ?info=1
    if qs0.get('info'):
        res = tg_call('getWebhookInfo', {})
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps(res)}
    # Какому боту принадлежит токен: ?me=1
    if qs0.get('me'):
        res = tg_call('getMe', {})
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps(res)}
    # Удалить webhook и сбросить накопленные апдейты: ?reset=1
    if qs0.get('reset'):
        res = tg_call('deleteWebhook', {'drop_pending_updates': True})
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps(res)}
    # Проверка ЮKassa: ?testpay=1 — создать пробный платёж на 10 ₽.
    if qs0.get('testpay'):
        from lib import yk_create_payment
        has_keys = bool(os.environ.get('YOOKASSA_SHOP_ID') and os.environ.get('YOOKASSA_SECRET_KEY'))
        pay = yk_create_payment(10.0, 'Проверка интеграции ЮKassa', {'test': '1'})
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({
            'keys_present': has_keys,
            'ok': pay.get('ok'),
            'has_url': bool(pay.get('url')),
            'error': pay.get('error', ''),
        })}
    # Привязать webhook к самому себе по GET из браузера: ?bind=1
    if qs0.get('bind'):
        import urllib.request as _u
        import urllib.parse as _up
        from lib import bot_token as _bt
        self_url = 'https://functions.poehali.dev/84e2bef2-8bf6-46b9-a156-ce877a6c3c98'
        q = _up.urlencode({
            'url': self_url,
            'allowed_updates': json.dumps(['message', 'callback_query']),
            'drop_pending_updates': 'true',
        })
        api = f'https://api.telegram.org/bot{_bt()}/setWebhook?{q}'
        last = ''
        ok = False
        for _ in range(8):
            try:
                with _u.urlopen(api, timeout=8) as resp:
                    j = json.loads(resp.read())
                last = j.get('description', '')
                if j.get('ok'):
                    ok = True
                    break
            except Exception as e:
                last = f'{type(e).__name__}'
        msg = '✅ Webhook привязан! Бот готов к работе.' if ok else f'❌ Не удалось: {last}'
        html = f"<html><body style='font-family:sans-serif;font-size:20px;padding:40px'>{msg}</body></html>"
        return {'statusCode': 200, 'headers': {'Content-Type': 'text/html; charset=utf-8',
                'Access-Control-Allow-Origin': '*'}, 'body': html}

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
        import urllib.request as _u
        import urllib.parse as _up
        from lib import bot_token as _bt
        token = _bt()
        # GET-запрос с параметрами в URL — самый лёгкий способ, реже таймаутит.
        q = _up.urlencode({
            'url': self_url,
            'allowed_updates': json.dumps(['message', 'callback_query']),
            'drop_pending_updates': 'true',
        })
        api = f'https://api.telegram.org/bot{token}/setWebhook?{q}'
        set_res = {}
        for _ in range(6):
            try:
                with _u.urlopen(api, timeout=8) as resp:
                    set_res = json.loads(resp.read())
                if set_res.get('ok'):
                    break
            except Exception as e:
                set_res = {'ok': False, 'error': f'{type(e).__name__}'}
        ok = bool(set_res.get('ok'))
        desc = set_res.get('description') or set_res.get('error') or ''
        return {'statusCode': 200, 'headers': cors,
                'body': json.dumps({'setOk': ok, 'desc': desc})}

    try:
        if qs.get('yookassa'):
            handle_yookassa(body)
        else:
            handle_telegram(body)
    except Exception as e:
        print(f'handler error: {e}')

    return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'ok': True})}