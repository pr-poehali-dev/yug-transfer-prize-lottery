"""Бот @zacazubot: приём заказов в очередь, оплата комиссии через ЮKassa."""
import os
import json
import psycopg2
import psycopg2.extras
from datetime import datetime

from lib import (
    SCHEMA, DEADLINE_MINUTES, tg_send, tg_answer_callback, tg_call,
    yk_create_payment, get_order, queue_list, render_queue_text, render_queue_block,
    client_contacts_text, contacts_block, order_brief, order_public_text, mention, deadline_dt,
    has_active_sub, sub_active_until, commission_for, extend_sub, SUB_PLANS,
    edit_second_message,
)

BOT_USERNAME = os.environ.get('ZACAZU_BOT_USERNAME', 'zacazubot')


def db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def sweep_expired(cur, conn):
    """Проверяет просроченные оплаты (>5 мин) и передаёт заказ следующему.
       Вызывается при каждом обращении к боту — заменяет внешний cron."""
    now_utc = datetime.utcnow()
    cur.execute(
        f"SELECT id, current_user_id FROM {SCHEMA}.dispatch_orders "
        f"WHERE sale_status='selling' AND current_deadline IS NOT NULL "
        f"AND current_deadline < %s",
        (now_utc,),
    )
    expired = cur.fetchall()
    for o in expired:
        order_id = o['id']
        uid = o['current_user_id']
        # Не успел оплатить — убираем из очереди, чтобы мог встать заново.
        cur.execute(
            f"DELETE FROM {SCHEMA}.order_queue "
            f"WHERE order_id=%s AND tg_user_id=%s AND status='paying'",
            (order_id, uid),
        )
        cur.execute(
            f"UPDATE {SCHEMA}.dispatch_orders SET current_user_id=NULL, current_deadline=NULL WHERE id=%s",
            (order_id,),
        )
        conn.commit()
        if uid:
            tg_send(uid,
                    "⌛ Время на оплату вышло — заказ передан следующему.\n"
                    "Если заказ ещё открыт, можешь снова нажать «Принять заказ».")
        # Сразу убираем неоплатившего из списка в сообщении заказа.
        update_queue_message(cur, conn, order_id)
        offer_to_first(cur, conn, order_id)

    # «Замершие» заказы: есть очередь (waiting), но никому не предложена оплата —
    # предлагаем первому в очереди.
    cur.execute(
        f"SELECT d.id FROM {SCHEMA}.dispatch_orders d "
        f"WHERE d.sale_status='selling' AND d.current_deadline IS NULL "
        f"AND EXISTS (SELECT 1 FROM {SCHEMA}.order_queue q WHERE q.order_id=d.id AND q.status='waiting') "
        f"AND NOT EXISTS (SELECT 1 FROM {SCHEMA}.order_queue q WHERE q.order_id=d.id AND q.status='paying')"
    )
    for r in cur.fetchall():
        offer_to_first(cur, conn, r['id'])


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

    # Подписчику комиссия по любому заказу = 10% от цены, остальным — как в заказе.
    amount = commission_for(cur, dict(o), nxt['tg_user_id'])
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
        res = tg_send(
            nxt['tg_user_id'],
            order_public_text(dict(o)) + '\n\n'
            f"🧪 Тестовый режим (ЮKassa ещё не подключена). Комиссия была бы <b>{amount:.0f} ₽</b>.\n"
            f"Нажми кнопку ниже, чтобы сымитировать оплату ({DEADLINE_MINUTES} мин).",
            {'inline_keyboard': [[{'text': f'✅ Я оплатил (тест)', 'callback_data': f'paid:{order_id}'}]]},
        )
        _save_pay_msg(cur, conn, nxt['id'], nxt['tg_user_id'], res)
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

    is_sub = has_active_sub(cur, nxt['tg_user_id'])
    res = send_payment_message(nxt['tg_user_id'], dict(o), amount, pay['url'], is_sub)
    _save_pay_msg(cur, conn, nxt['id'], nxt['tg_user_id'], res)
    update_queue_message(cur, conn, order_id)


def send_payment_message(user_id, order: dict, amount: float, pay_url: str, is_sub: bool = False) -> dict:
    """Отправляет водителю инфо о заказе и кнопку оплаты комиссии."""
    # Показываем фактическую сумму к оплате (для подписчика — 10%).
    o = dict(order)
    o['commission_rub'] = amount
    note = " ✅ скидка по подписке (10%)" if is_sub else ""
    return tg_send(
        user_id,
        order_public_text(o) + '\n\n'
        f"💳 Оплати комиссию <b>{amount:.0f} ₽</b>{note} в течение {DEADLINE_MINUTES} минут.\n"
        f"После оплаты пришлю контакты клиента.",
        {'inline_keyboard': [[{'text': f'💳 Оплатить {amount:.0f} ₽', 'url': pay_url}]]},
    )


def _save_pay_msg(cur, conn, queue_id: int, chat_id, res: dict):
    """Запоминает message_id сообщения с кнопкой оплаты, чтобы потом его отредактировать."""
    msg_id = (res.get('result') or {}).get('message_id') if isinstance(res, dict) else None
    if msg_id:
        cur.execute(
            f"UPDATE {SCHEMA}.order_queue SET pay_msg_id=%s, pay_chat_id=%s WHERE id=%s",
            (msg_id, chat_id, queue_id),
        )
        conn.commit()


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

    # Не заменяем текст заказа, а ДОПИСЫВАЕМ блок контактов к информации о заказе.
    contacts = order_public_text(dict(o)) + '\n\n' + contacts_block(dict(o))
    keyboard = {'inline_keyboard': [[{'text': '🚗 Клиент в машине', 'callback_data': f'trip_pickup:{order_id}'}]]}

    # Если у победителя есть сообщение с кнопкой «Оплатить» — редактируем ЕГО,
    # чтобы текст и кнопки заменились в одном сообщении (без нового сообщения).
    pay_chat = winner.get('pay_chat_id') or winner['tg_user_id']
    pay_msg = winner.get('pay_msg_id')
    win_msg_id = None
    win_chat = None
    if pay_msg:
        edited = tg_call('editMessageText', {
            'chat_id': pay_chat, 'message_id': pay_msg,
            'text': contacts, 'parse_mode': 'HTML', 'disable_web_page_preview': True,
            'reply_markup': keyboard,
        })
        if edited.get('ok'):
            win_msg_id = pay_msg
            win_chat = pay_chat

    # Если отредактировать не удалось (нет id / сообщение слишком старое) — шлём новое.
    if not win_msg_id:
        res = tg_send(winner['tg_user_id'], contacts, keyboard)
        win_msg_id = (res.get('result') or {}).get('message_id')
        win_chat = winner['tg_user_id']

    cur.execute(
        f"UPDATE {SCHEMA}.dispatch_orders SET trip_status='waiting_pickup', "
        f"winner_chat_id=%s, winner_message_id=%s WHERE id=%s",
        (win_chat, win_msg_id, order_id),
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
        edit_second_message(dict(o), text)  # та же отметка во второй группе


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
    kb = {'inline_keyboard': [[btn]]}
    tg_call('editMessageText', {
        'chat_id': o['tg_chat_id'], 'message_id': o['tg_message_id'],
        'text': text, 'parse_mode': 'HTML', 'disable_web_page_preview': True,
        'reply_markup': kb,
    })
    edit_second_message(dict(o), text, kb)  # та же очередь во второй группе


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


def handle_decline(cur, conn, order_id: int, user: dict, callback_id: str):
    """Водитель отказался от заказа: убираем из очереди и передаём следующему."""
    uid = user.get('id')
    o = get_order(cur, order_id)
    if not o:
        tg_answer_callback(callback_id, 'Заказ не найден', True)
        return
    cur.execute(
        f"SELECT id, status, pay_chat_id, pay_msg_id FROM {SCHEMA}.order_queue "
        f"WHERE order_id=%s AND tg_user_id=%s LIMIT 1",
        (order_id, uid),
    )
    q = cur.fetchone()
    if not q:
        tg_answer_callback(callback_id, 'Тебя нет в очереди по этому заказу', True)
        return
    # Удаляем водителя из очереди; если он был плательщиком — освобождаем заказ.
    cur.execute(f"DELETE FROM {SCHEMA}.order_queue WHERE id=%s", (q['id'],))
    if q['status'] == 'paying':
        cur.execute(
            f"UPDATE {SCHEMA}.dispatch_orders SET current_user_id=NULL, current_deadline=NULL WHERE id=%s",
            (order_id,),
        )
    conn.commit()
    tg_answer_callback(callback_id, 'Ты отказался от заказа', False)
    # Сообщение с кнопкой оплаты заменяем на отметку об отказе.
    pay_chat = q.get('pay_chat_id') or uid
    pay_msg = q.get('pay_msg_id')
    if pay_msg:
        tg_call('editMessageText', {
            'chat_id': pay_chat, 'message_id': pay_msg,
            'text': order_public_text(dict(o)) + '\n\n❌ <b>Ты отказался от заказа</b>',
            'parse_mode': 'HTML', 'disable_web_page_preview': True,
            'reply_markup': {'inline_keyboard': []},
        })
    # Обновляем очередь в группе и передаём заказ следующему.
    update_queue_message(cur, conn, order_id)
    if o['sale_status'] == 'selling':
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
            text = (order_public_text(dict(o)) + '\n\n' + contacts_block(dict(o), with_phone=True)
                    + '\n\n🚗 <b>Клиент в машине</b>')
            tg_call('editMessageText', {
                'chat_id': win_chat, 'message_id': win_msg,
                'text': text,
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
    # Завершён — оставляем инфо о заказе, дописываем статус, убираем кнопки.
    if win_chat and win_msg:
        text = order_public_text(dict(o)) + '\n\n━━━━━━━━━━━━━━━\n✅ <b>Заказ завершён</b>'
        tg_call('editMessageText', {
            'chat_id': win_chat, 'message_id': win_msg,
            'text': text,
            'parse_mode': 'HTML', 'disable_web_page_preview': True,
            'reply_markup': {'inline_keyboard': []},
        })


# Нижняя клавиатура (reply keyboard) — не мешает приёму заказов, всегда под рукой.
SUB_BTN_SUB = '💳 Подписка'
SUB_BTN_STATUS = '📊 Мой статус'
SUB_BTN_1 = '1 месяц 1 500 ₽'
SUB_BTN_6 = '6 мес 6 000 ₽'
SUB_BTN_12 = '12 мес 10 000 ₽'


def sub_reply_keyboard():
    return {
        'keyboard': [
            [{'text': SUB_BTN_SUB}, {'text': SUB_BTN_STATUS}],
            [{'text': SUB_BTN_1}, {'text': SUB_BTN_6}, {'text': SUB_BTN_12}],
        ],
        'resize_keyboard': True,
        'is_persistent': True,
    }


def send_sub_button(chat_id):
    """Яркая синяя inline-кнопка «Подписка» прямо над строкой ввода."""
    tg_send(
        chat_id,
        "👇 Оформить подписку:",
        {'inline_keyboard': [[{'text': '💳 Подписка', 'callback_data': 'sub_buy_menu'}]]},
    )


def send_start_menu(chat_id, force: bool = True):
    tg_send(
        chat_id,
        "👋 <b>Добро пожаловать!</b>\n\n"
        "С подпиской ваша комиссия снижается до <b>10%</b> по любому заказу.",
        sub_reply_keyboard(),
    )


def start_already_seen(cur, conn, uid, user=None) -> bool:
    """True, если пользователь уже получал приветствие. Иначе помечает и возвращает False."""
    cur.execute(f"SELECT seen_start FROM {SCHEMA}.driver_subs WHERE tg_user_id=%s", (uid,))
    row = cur.fetchone()
    seen = bool(row and (row['seen_start'] if isinstance(row, dict) else row[0]))
    if seen:
        return True
    u = user or {}
    cur.execute(
        f"INSERT INTO {SCHEMA}.driver_subs (tg_user_id, username, first_name, seen_start, updated_at) "
        f"VALUES (%s,%s,%s,TRUE,NOW()) "
        f"ON CONFLICT (tg_user_id) DO UPDATE SET seen_start=TRUE, updated_at=NOW()",
        (uid, u.get('username', '') or '', u.get('first_name', '') or ''),
    )
    conn.commit()
    return False


def handle_sub_status(cur, chat_id, uid):
    until = sub_active_until(cur, uid)
    if until and until > datetime.utcnow():
        days = (until - datetime.utcnow()).days
        tg_send(chat_id,
                f"✅ <b>Подписка активна</b>\n"
                f"Комиссия по заказам: <b>10%</b>\n"
                f"Действует до: <b>{until.strftime('%d.%m.%Y')}</b> (осталось ~{days} дн.)",
                sub_reply_keyboard())
    else:
        tg_send(chat_id,
                "❌ <b>Подписка не активна</b>\n"
                "Без подписки комиссия — как указано в заказе.\n"
                "Оформите подписку кнопками внизу, чтобы платить всего 10%.",
                sub_reply_keyboard())


def handle_sub_buy(cur, chat_id, user, plan_key: str):
    plan = SUB_PLANS.get(plan_key)
    if not plan:
        return
    months, price, label = plan
    uid = user.get('id')
    yk_ready = bool(os.environ.get('YOOKASSA_SHOP_ID') and os.environ.get('YOOKASSA_SECRET_KEY'))
    if not yk_ready:
        tg_send(chat_id, "⚠️ Оплата подписки временно недоступна. Попробуйте позже.")
        return
    pay = yk_create_payment(
        float(price), f'Подписка водителя {label}',
        {'kind': 'sub', 'tg_user_id': str(uid), 'months': str(months),
         'username': user.get('username', '') or '', 'first_name': user.get('first_name', '') or ''},
    )
    if not pay.get('ok') or not pay.get('url'):
        tg_send(chat_id, f"⚠️ Не удалось создать оплату: {pay.get('error', 'ошибка')}.")
        return
    tg_send(chat_id,
            f"💳 <b>Подписка {label}</b> — {price} ₽\n"
            f"После оплаты комиссия по заказам станет <b>10%</b>.",
            {'inline_keyboard': [[{'text': f'💳 Оплатить {price} ₽', 'url': pay['url']}]]})


def handle_telegram(update: dict):
    conn = db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        # На каждом действии проверяем просроченные оплаты и передаём дальше.
        try:
            sweep_expired(cur, conn)
        except Exception as e:
            print(f"sweep_expired error: {e}")
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
            elif data == 'sub_menu':
                tg_answer_callback(cb['id'])
                send_start_menu(user.get('id'))
            elif data == 'sub_buy_menu':
                tg_answer_callback(cb['id'])
                tg_send(
                    user.get('id'),
                    "💳 <b>Оформление подписки</b>\n\n"
                    "С подпиской комиссия по любому заказу — всего <b>10%</b>.\n"
                    "Выбери срок:",
                    {'inline_keyboard': [
                        [{'text': SUB_BTN_1, 'callback_data': 'sub_1'}],
                        [{'text': SUB_BTN_6, 'callback_data': 'sub_6'}],
                        [{'text': SUB_BTN_12, 'callback_data': 'sub_12'}],
                    ]},
                )
            elif data == 'sub_status':
                tg_answer_callback(cb['id'])
                handle_sub_status(cur, user.get('id'), user.get('id'))
            elif data in ('sub_1', 'sub_6', 'sub_12'):
                tg_answer_callback(cb['id'])
                handle_sub_buy(cur, user.get('id'), user, data)
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
                # Меню подписки доступно ТОЛЬКО в личке с ботом, в группах игнорируем.
                if chat_type != 'private':
                    return
                u = msg.get('from', {})
                start_already_seen(cur, conn, u.get('id'), u)
                send_start_menu(chat['id'])
            elif text.startswith('/podpiska') or text.startswith('/подписка') or text.startswith('/sub'):
                if chat_type != 'private':
                    return
                send_start_menu(chat['id'])
            elif text.startswith('/status'):
                if chat_type != 'private':
                    return
                uid = msg.get('from', {}).get('id')
                handle_sub_status(cur, chat['id'], uid)
            # Нажатия кнопок нижней клавиатуры (приходят как текст) — только в личке.
            elif chat_type == 'private' and text == SUB_BTN_SUB:
                send_start_menu(chat['id'])
            elif chat_type == 'private' and text == SUB_BTN_STATUS:
                handle_sub_status(cur, chat['id'], msg.get('from', {}).get('id'))
            elif chat_type == 'private' and text == SUB_BTN_1:
                handle_sub_buy(cur, chat['id'], msg.get('from', {}), 'sub_1')
            elif chat_type == 'private' and text == SUB_BTN_6:
                handle_sub_buy(cur, chat['id'], msg.get('from', {}), 'sub_6')
            elif chat_type == 'private' and text == SUB_BTN_12:
                handle_sub_buy(cur, chat['id'], msg.get('from', {}), 'sub_12')
    finally:
        cur.close()
        conn.close()


def handle_yookassa(body: dict):
    """Webhook ЮKassa: оплата заказа (контакты победителю) или подписки (активация)."""
    event = body.get('event', '')
    obj = body.get('object', {})
    payment_id = obj.get('id', '')
    if event != 'payment.succeeded' or not payment_id:
        return
    meta = obj.get('metadata') or {}
    conn = db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        # Оплата ПОДПИСКИ.
        if meta.get('kind') == 'sub':
            uid = meta.get('tg_user_id')
            months = int(meta.get('months') or 1)
            if uid:
                until = extend_sub(cur, conn, int(uid), months,
                                   meta.get('username', ''), meta.get('first_name', ''), payment_id)
                tg_send(int(uid),
                        f"✅ <b>Подписка активирована!</b>\n"
                        f"Теперь комиссия по заказам — <b>10%</b>.\n"
                        f"Действует до: <b>{until.strftime('%d.%m.%Y')}</b>")
            return
        # Оплата КОМИССИИ за заказ.
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
    # Авто-проверка просрочек из админки: ?sweep=1 — передаёт заказы следующим,
    # возвращает, есть ли ещё заказы на продаже (чтобы фронт знал, продолжать ли).
    if qs0.get('sweep'):
        conn = db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        try:
            sweep_expired(cur, conn)
            cur.execute(
                f"SELECT COUNT(*) AS c FROM {SCHEMA}.dispatch_orders WHERE sale_status='selling'"
            )
            active = int(cur.fetchone()['c'])
        finally:
            cur.close()
            conn.close()
        return {'statusCode': 200, 'headers': cors,
                'body': json.dumps({'ok': True, 'active_orders': active})}
    # Узнать ID чата по @username: ?getchat=@UG_DRIVER
    if qs0.get('getchat'):
        res = tg_call('getChat', {'chat_id': qs0.get('getchat')})
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps(res)}
    # Диагностика webhook: GET ?info=1
    if qs0.get('info'):
        res = tg_call('getWebhookInfo', {})
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps(res)}
    # Какому боту принадлежит токен: ?me=1
    if qs0.get('me'):
        res = tg_call('getMe', {})
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps(res)}
    # Настроить кнопку «Меню» возле строки ввода и команды бота: ?setupmenu=1
    if qs0.get('setupmenu'):
        private_cmds = [
            {'command': 'start', 'description': '🏠 Главное меню'},
            {'command': 'podpiska', 'description': '💳 Подписка'},
            {'command': 'status', 'description': '📊 Мой статус'},
        ]
        # Команды видны ТОЛЬКО в личке с ботом.
        cmds = tg_call('setMyCommands', {
            'commands': private_cmds,
            'scope': {'type': 'all_private_chats'},
        })
        # В группах команды бота скрываем полностью.
        tg_call('deleteMyCommands', {'scope': {'type': 'all_group_chats'}})
        tg_call('deleteMyCommands', {})  # сброс дефолтного scope (на всякий случай)
        menu = tg_call('setChatMenuButton', {
            'menu_button': {'type': 'commands', 'text': 'Подписка'}
        })
        return {'statusCode': 200, 'headers': cors,
                'body': json.dumps({'commands': cmds, 'menu': menu})}
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