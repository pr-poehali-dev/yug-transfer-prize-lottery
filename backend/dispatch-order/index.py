"""Диспетчерская: отправка заказов в Telegram и архив предварительных заказов."""
import os
import json
import time
import urllib.request
import urllib.error
import psycopg2
import psycopg2.extras

SCHEMA = os.environ.get('MAIN_DB_SCHEMA') or 't_p67171637_yug_transfer_prize_l'


def db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


BOT_USERNAME = 'zacazubot'
ACCEPT_BUTTON_TEXT = '✅ Принять заказ'


def tg_send(text: str, order_id: int, chat_id: str = None) -> dict:
    token = (os.environ.get('ZACAZU_BOT_TOKEN_NEW', '')
             or os.environ.get('ZACAZU_BOT_TOKEN', '')
             or os.environ.get('TELEGRAM_BOT_TOKEN', ''))
    if chat_id is None:
        chat_id = os.environ.get('DISPATCH_CHAT_ID', '')
    if not token:
        return {'ok': False, 'error': 'ZACAZU_BOT_TOKEN не задан'}
    if not chat_id:
        return {'ok': False, 'error': 'DISPATCH_CHAT_ID не задан'}
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = json.dumps({
        'chat_id': chat_id,
        'text': text,
        'parse_mode': 'HTML',
        'disable_web_page_preview': True,
        'reply_markup': {
            'inline_keyboard': [[
                {'text': ACCEPT_BUTTON_TEXT,
                 'url': f'https://t.me/{BOT_USERNAME}?start=accept_{order_id}'}
            ]]
        },
    }).encode()
    last_err = 'fail'
    # До 3 попыток: единичные сетевые таймауты Telegram не должны срывать отправку.
    for attempt in range(3):
        req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json'}, method='POST')
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            try:
                body = json.loads(e.read())
                return {'ok': False, 'error': f"HTTP {e.code}: {body.get('description', '')[:200]}"}
            except Exception:
                return {'ok': False, 'error': f"HTTP {e.code}"}
        except Exception as e:
            last_err = f"{type(e).__name__}: {str(e)[:200]}"
            if attempt < 2:
                time.sleep(2)
    return {'ok': False, 'error': last_err}


def parse_num(v) -> float:
    s = str(v or '').replace(',', '.')
    digits = ''.join(ch for ch in s if (ch.isdigit() or ch == '.'))
    try:
        return float(digits) if digits else 0.0
    except Exception:
        return 0.0


def calc_commission_rub(price, commission_pct) -> float:
    price_num = parse_num(price)
    pct = parse_num(commission_pct)
    return round(price_num * pct / 100.0, 2)


def esc(v) -> str:
    s = '' if v is None else str(v)
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def fmt_pct(v) -> str:
    """Возвращает процент без задвоения знака %."""
    s = str(v or '').strip()
    return s if s.endswith('%') else f"{s}%"


def build_message(d: dict) -> str:
    """Публичное сообщение в группу — БЕЗ точных адресов и контактов клиента."""
    lines = ['🚖 <b>НОВЫЙ ЗАКАЗ</b>', '']

    route = []
    if d.get('from_city'):
        route.append(f"📍 <b>Откуда:</b> {esc(d['from_city'])}")
    if d.get('to_city'):
        route.append(f"🏁 <b>Куда:</b> {esc(d['to_city'])}")
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
        order.append(f"📊 <b>Комиссия:</b> {esc(fmt_pct(d['commission']))}")
    if order:
        lines += order

    # Адреса и данные клиента в группу НЕ отправляем —
    # они приходят победителю в личку после оплаты.
    return '\n'.join(lines)


def has_content(d: dict) -> bool:
    return bool(d.get('from_city') or d.get('to_city') or d.get('client_phone'))


def mention(uid, username, first_name) -> str:
    if username:
        return f'@{esc(username)}'
    name = esc(first_name or 'Водитель')
    return f'<a href="tg://user?id={uid}">{name}</a>'


def render_queue_block(order_id: int) -> str:
    """Блок «Откликнувшиеся водители» — для сохранения списка при редактировании."""
    conn = db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        f"SELECT tg_user_id, username, first_name, position, status FROM {SCHEMA}.order_queue "
        f"WHERE order_id=%s ORDER BY position ASC", (order_id,)
    )
    queue = cur.fetchall()
    cur.close()
    conn.close()
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


def row_to_order(r: dict) -> dict:
    stops = r.get('stops')
    if isinstance(stops, str):
        try:
            stops = json.loads(stops)
        except Exception:
            stops = []
    return {
        'id': r['id'],
        'from_city': r['from_city'] or '',
        'to_city': r['to_city'] or '',
        'from_address': r['from_address'] or '',
        'to_address': r['to_address'] or '',
        'stops': stops or [],
        'date': r['order_date'] or '',
        'time': r['order_time'] or '',
        'price': r['price'] or '',
        'tariff': r['tariff'] or '',
        'commission': r['commission'] or '',
        'client_phone': r['client_phone'] or '',
        'people': r['people'] or '',
        'luggage': r['luggage'] or '',
        'booster': bool(r['booster']),
        'child_seat': bool(r['child_seat']),
        'animal': bool(r['animal']),
        'comment': r['comment'] or '',
        'created_at': r['created_at'].isoformat() if r.get('created_at') else None,
        'sale_status': r.get('sale_status') or 'archived',
        'trip_status': r.get('trip_status') or '',
        'winner_user_id': r.get('winner_user_id'),
        'winner_username': r.get('winner_username') or '',
        'winner_first_name': r.get('winner_first_name') or '',
        'refunds_count': int(r.get('refunds_count') or 0),
    }


def archive_save(d: dict) -> dict:
    conn = db()
    cur = conn.cursor()
    cur.execute(
        f"INSERT INTO {SCHEMA}.dispatch_orders "
        f"(from_city, to_city, from_address, to_address, stops, order_date, order_time, "
        f"price, tariff, commission, client_phone, people, luggage, booster, child_seat, animal, comment) "
        f"VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
        (
            d.get('from_city', ''), d.get('to_city', ''), d.get('from_address', ''), d.get('to_address', ''),
            json.dumps([s for s in (d.get('stops') or []) if s]), d.get('date', ''), d.get('time', ''),
            str(d.get('price', '')), d.get('tariff', ''), d.get('commission', ''),
            d.get('client_phone', ''), str(d.get('people', '')), str(d.get('luggage', '')),
            bool(d.get('booster')), bool(d.get('child_seat')), bool(d.get('animal')), d.get('comment', ''),
        ),
    )
    new_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return {'ok': True, 'id': new_id}


def archive_list() -> dict:
    conn = db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        f"SELECT d.*, q.username AS winner_username, q.first_name AS winner_first_name, "
        f"(SELECT COUNT(*) FROM {SCHEMA}.order_queue rq "
        f" WHERE rq.order_id = d.id AND rq.status='refunded') AS refunds_count "
        f"FROM {SCHEMA}.dispatch_orders d "
        f"LEFT JOIN {SCHEMA}.order_queue q "
        f"ON q.order_id = d.id AND q.tg_user_id = d.winner_user_id AND q.status='paid' "
        f"ORDER BY d.created_at DESC LIMIT 200"
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return {'ok': True, 'orders': [row_to_order(dict(r)) for r in rows]}


def cleanup_unpaid() -> dict:
    """Убирает из очередей всех, кто не купил: статусы expired и просроченные paying.
       Пересчитывает позиции и обновляет сообщения заказов в группе."""
    conn = db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    # Заказы, где есть кого чистить.
    cur.execute(
        f"SELECT DISTINCT q.order_id FROM {SCHEMA}.order_queue q "
        f"JOIN {SCHEMA}.dispatch_orders d ON d.id=q.order_id "
        f"WHERE q.status IN ('expired') "
        f"OR (q.status='paying' AND d.current_deadline IS NOT NULL AND d.current_deadline < NOW())"
    )
    order_ids = [r['order_id'] for r in cur.fetchall()]
    removed = 0
    for oid in order_ids:
        cur.execute(
            f"DELETE FROM {SCHEMA}.order_queue q USING {SCHEMA}.dispatch_orders d "
            f"WHERE q.order_id=%s AND q.order_id=d.id AND ("
            f"q.status='expired' OR "
            f"(q.status='paying' AND d.current_deadline IS NOT NULL AND d.current_deadline < NOW()))",
            (oid,),
        )
        removed += cur.rowcount
        # Сбрасываем плательщика, если он был удалён.
        cur.execute(
            f"UPDATE {SCHEMA}.dispatch_orders SET current_user_id=NULL, current_deadline=NULL "
            f"WHERE id=%s AND NOT EXISTS (SELECT 1 FROM {SCHEMA}.order_queue WHERE order_id=%s AND status='paying')",
            (oid, oid),
        )
        conn.commit()
        # Пересчитываем позиции оставшихся.
        cur.execute(
            f"SELECT id FROM {SCHEMA}.order_queue WHERE order_id=%s ORDER BY position ASC", (oid,)
        )
        for i, r in enumerate(cur.fetchall(), start=1):
            cur.execute(f"UPDATE {SCHEMA}.order_queue SET position=%s WHERE id=%s", (i, r['id']))
        conn.commit()
        # Обновляем сообщение заказа в группе.
        cur.execute(
            f"SELECT tg_message_id, tg_message_text FROM {SCHEMA}.dispatch_orders WHERE id=%s", (oid,)
        )
        row = cur.fetchone()
        if row and row['tg_message_id']:
            base = row['tg_message_text'] or '🚖 <b>ЗАКАЗ</b>'
            tg_edit_order(row['tg_message_id'], base + render_queue_block(oid), oid)
    cur.close()
    conn.close()
    return {'ok': True, 'removed': removed, 'orders': len(order_ids)}


def archive_delete(order_id: int) -> dict:
    conn = db()
    cur = conn.cursor()
    cur.execute(f"DELETE FROM {SCHEMA}.dispatch_orders WHERE id = %s", (order_id,))
    conn.commit()
    cur.close()
    conn.close()
    return {'ok': True}


def update_order(d: dict) -> dict:
    """Сохраняет ВСЕ поля заказа без смены статуса/очереди.
       Если заказ сейчас продаётся и опубликован — обновляет сообщение в группе."""
    oid = int(d['id'])
    commission_rub = calc_commission_rub(d.get('price'), d.get('commission'))
    conn = db()
    cur = conn.cursor()
    cur.execute(
        f"UPDATE {SCHEMA}.dispatch_orders SET "
        f"from_city=%s, to_city=%s, from_address=%s, to_address=%s, stops=%s, order_date=%s, order_time=%s, "
        f"price=%s, tariff=%s, commission=%s, client_phone=%s, people=%s, luggage=%s, "
        f"booster=%s, child_seat=%s, animal=%s, comment=%s, commission_rub=%s "
        f"WHERE id=%s",
        (
            d.get('from_city', ''), d.get('to_city', ''), d.get('from_address', ''), d.get('to_address', ''),
            json.dumps([s for s in (d.get('stops') or []) if s]), d.get('date', ''), d.get('time', ''),
            str(d.get('price', '')), d.get('tariff', ''), d.get('commission', ''),
            d.get('client_phone', ''), str(d.get('people', '')), str(d.get('luggage', '')),
            bool(d.get('booster')), bool(d.get('child_seat')), bool(d.get('animal')), d.get('comment', ''),
            commission_rub, oid,
        ),
    )
    conn.commit()
    # Если заказ ещё продаётся и опубликован — обновим текст сообщения в группе.
    cur.execute(
        f"SELECT tg_message_id, sale_status FROM {SCHEMA}.dispatch_orders WHERE id=%s", (oid,)
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    if row and row[0] and row[1] == 'selling':
        text = build_text_for(oid, d)
        set_order_message(oid, row[0], text)
        full = text + render_queue_block(oid)
        tg_edit_order(row[0], full, oid)
        edit_second(oid, full)
    # Главное: обновляем личное сообщение победителя (контакты клиента),
    # чтобы изменённый телефон/адрес сразу увидел водитель.
    update_winner_message(oid)
    return {'ok': True, 'id': oid}


def build_text_for(order_id: int, d: dict) -> str:
    commission_rub = calc_commission_rub(d.get('price'), d.get('commission'))
    t = f"🔖 <b>Заказ #{order_id}</b>\n\n" + build_message(d)
    if commission_rub > 0:
        t += f"\n\n💳 <b>Комиссия за заказ:</b> {commission_rub:.0f} ₽"
    t += f"\n\n👉 Нажми «Принять заказ» и оплати комиссию в течение 5 минут.\n#заказ_{order_id}"
    return t


def winner_order_text(o: dict) -> str:
    """Текст личного сообщения победителю: инфо о заказе + контакты клиента."""
    head = f"🔖 <b>Заказ #{o['id']}</b> — ИНФОРМАЦИЯ"
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

    lines += ['', '━━━━━━━━━━━━━━━', '🎉 <b>Заказ ваш! Контакты клиента:</b>', '']
    lines.append(f"📞 <b>Телефон:</b> {esc(o.get('client_phone') or '—')}")
    if o.get('from_address'):
        lines.append(f"➡️ <b>Точный адрес подачи:</b> {esc(o['from_address'])}")
    if o.get('to_address'):
        lines.append(f"⬅️ <b>Точный адрес назначения:</b> {esc(o['to_address'])}")
    if o.get('comment'):
        lines.append(f"💬 {esc(o['comment'])}")
    return '\n'.join(lines)


def tg_edit_dm(chat_id, message_id, text: str, keyboard: dict) -> dict:
    """Редактирует личное сообщение водителю с заданной клавиатурой."""
    token = (os.environ.get('ZACAZU_BOT_TOKEN_NEW', '')
             or os.environ.get('ZACAZU_BOT_TOKEN', '')
             or os.environ.get('TELEGRAM_BOT_TOKEN', ''))
    if not token or not chat_id or not message_id:
        return {'ok': False, 'error': 'no creds/message'}
    payload = json.dumps({
        'chat_id': chat_id, 'message_id': message_id, 'text': text,
        'parse_mode': 'HTML', 'disable_web_page_preview': True,
        'reply_markup': keyboard,
    }).encode()
    url = f"https://api.telegram.org/bot{token}/editMessageText"
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, data=payload,
                                         headers={'Content-Type': 'application/json'}, method='POST')
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            try:
                body = json.loads(e.read())
                if 'message is not modified' in body.get('description', ''):
                    return {'ok': True, 'unchanged': True}
                return {'ok': False, 'error': body.get('description', f'HTTP {e.code}')}
            except Exception:
                return {'ok': False, 'error': f'HTTP {e.code}'}
        except Exception:
            if attempt < 2:
                time.sleep(2)
    return {'ok': False, 'error': 'fail'}


def update_winner_message(order_id: int):
    """Если у заказа есть победитель с личным сообщением — пересобираем его
       (контакты клиента) с актуальными данными и нужной кнопкой по trip_status."""
    conn = db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        f"SELECT id, from_city, to_city, from_address, to_address, order_date, order_time, "
        f"price, tariff, client_phone, comment, commission_rub, trip_status, "
        f"winner_chat_id, winner_message_id "
        f"FROM {SCHEMA}.dispatch_orders WHERE id=%s", (order_id,)
    )
    o = cur.fetchone()
    cur.close()
    conn.close()
    if not o or not o.get('winner_chat_id') or not o.get('winner_message_id'):
        return
    o = dict(o)
    text = winner_order_text(o)
    ts = o.get('trip_status')
    if ts == 'completed':
        text += '\n\n✅ <b>Заказ завершён</b>'
        kb = {'inline_keyboard': []}
    elif ts == 'in_progress':
        text += '\n\n🚗 <b>Клиент в машине</b>'
        kb = {'inline_keyboard': [[{'text': '✅ Завершил заказ',
                                    'callback_data': f'trip_done:{order_id}'}]]}
    else:
        kb = {'inline_keyboard': [[{'text': '🚗 Клиент в машине',
                                    'callback_data': f'trip_pickup:{order_id}'}]]}
    tg_edit_dm(o['winner_chat_id'], o['winner_message_id'], text, kb)


def prepare_order_for_sale(d: dict, clear_queue: bool = True) -> int:
    """Сохраняет/обновляет заказ как «продаётся», возвращает его id."""
    commission_rub = calc_commission_rub(d.get('price'), d.get('commission'))
    chat_id = os.environ.get('DISPATCH_CHAT_ID', '')
    conn = db()
    cur = conn.cursor()
    if d.get('id'):
        oid = int(d['id'])
        # При редактировании уже опубликованного заказа (clear_queue=False)
        # НЕ сбрасываем очередь/победителя — только обновляем данные заказа.
        reset_sql = ("", " sale_status='selling', current_user_id=NULL, "
                     "current_deadline=NULL, winner_user_id=NULL,")[clear_queue]
        cur.execute(
            f"UPDATE {SCHEMA}.dispatch_orders SET "
            f"from_city=%s, to_city=%s, from_address=%s, to_address=%s, stops=%s, order_date=%s, order_time=%s, "
            f"price=%s, tariff=%s, commission=%s, client_phone=%s, people=%s, luggage=%s, "
            f"booster=%s, child_seat=%s, animal=%s, comment=%s, commission_rub=%s,{reset_sql} "
            f"tg_chat_id=%s "
            f"WHERE id=%s",
            (
                d.get('from_city', ''), d.get('to_city', ''), d.get('from_address', ''), d.get('to_address', ''),
                json.dumps([s for s in (d.get('stops') or []) if s]), d.get('date', ''), d.get('time', ''),
                str(d.get('price', '')), d.get('tariff', ''), d.get('commission', ''),
                d.get('client_phone', ''), str(d.get('people', '')), str(d.get('luggage', '')),
                bool(d.get('booster')), bool(d.get('child_seat')), bool(d.get('animal')), d.get('comment', ''),
                commission_rub, chat_id, oid,
            ),
        )
    else:
        cur.execute(
            f"INSERT INTO {SCHEMA}.dispatch_orders "
            f"(from_city, to_city, from_address, to_address, stops, order_date, order_time, "
            f"price, tariff, commission, client_phone, people, luggage, booster, child_seat, animal, comment, "
            f"commission_rub, sale_status, tg_chat_id) "
            f"VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'selling',%s) RETURNING id",
            (
                d.get('from_city', ''), d.get('to_city', ''), d.get('from_address', ''), d.get('to_address', ''),
                json.dumps([s for s in (d.get('stops') or []) if s]), d.get('date', ''), d.get('time', ''),
                str(d.get('price', '')), d.get('tariff', ''), d.get('commission', ''),
                d.get('client_phone', ''), str(d.get('people', '')), str(d.get('luggage', '')),
                bool(d.get('booster')), bool(d.get('child_seat')), bool(d.get('animal')), d.get('comment', ''),
                commission_rub, chat_id,
            ),
        )
        oid = cur.fetchone()[0]
    # Очищаем старую очередь только при свежей публикации (не при редактировании).
    if clear_queue:
        cur.execute(f"DELETE FROM {SCHEMA}.order_queue WHERE order_id=%s", (oid,))
    conn.commit()
    cur.close()
    conn.close()
    return oid


def get_published_state(order_id: int):
    """Возвращает (tg_message_id, sale_status) опубликованного заказа или (None, None)."""
    conn = db()
    cur = conn.cursor()
    cur.execute(
        f"SELECT tg_message_id, sale_status FROM {SCHEMA}.dispatch_orders WHERE id=%s",
        (order_id,),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    if not row:
        return (None, None)
    return (row[0], row[1])


def tg_edit_order(message_id, text: str, order_id: int, chat_id: str = None) -> dict:
    """Редактирует уже опубликованное сообщение заказа (сохраняя кнопку «Принять заказ»)."""
    token = (os.environ.get('ZACAZU_BOT_TOKEN_NEW', '')
             or os.environ.get('ZACAZU_BOT_TOKEN', '')
             or os.environ.get('TELEGRAM_BOT_TOKEN', ''))
    if chat_id is None:
        chat_id = os.environ.get('DISPATCH_CHAT_ID', '')
    if not token or not chat_id or not message_id:
        return {'ok': False, 'error': 'no creds/message'}
    payload = json.dumps({
        'chat_id': chat_id, 'message_id': message_id, 'text': text,
        'parse_mode': 'HTML', 'disable_web_page_preview': True,
        'reply_markup': {'inline_keyboard': [[
            {'text': ACCEPT_BUTTON_TEXT,
             'url': f'https://t.me/{BOT_USERNAME}?start=accept_{order_id}'}
        ]]},
    }).encode()
    url = f"https://api.telegram.org/bot{token}/editMessageText"
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, data=payload,
                                         headers={'Content-Type': 'application/json'}, method='POST')
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            try:
                body = json.loads(e.read())
                desc = body.get('description', '')
                # «message is not modified» — значит правок не было, считаем успехом.
                if 'message is not modified' in desc:
                    return {'ok': True, 'unchanged': True}
                return {'ok': False, 'error': f"HTTP {e.code}: {desc[:200]}"}
            except Exception:
                return {'ok': False, 'error': f"HTTP {e.code}"}
        except Exception:
            if attempt < 2:
                time.sleep(2)
    return {'ok': False, 'error': 'fail'}


def set_order_message(order_id: int, message_id, text: str = ''):
    conn = db()
    cur = conn.cursor()
    cur.execute(
        f"UPDATE {SCHEMA}.dispatch_orders SET tg_message_id=%s, tg_message_text=%s WHERE id=%s",
        (message_id, text, order_id),
    )
    conn.commit()
    cur.close()
    conn.close()


def set_order_message2(order_id: int, chat_id2: str, message_id2):
    conn = db()
    cur = conn.cursor()
    cur.execute(
        f"UPDATE {SCHEMA}.dispatch_orders SET tg_chat_id2=%s, tg_message_id2=%s WHERE id=%s",
        (chat_id2, message_id2, order_id),
    )
    conn.commit()
    cur.close()
    conn.close()


def get_second_msg(order_id: int):
    conn = db()
    cur = conn.cursor()
    cur.execute(f"SELECT tg_chat_id2, tg_message_id2 FROM {SCHEMA}.dispatch_orders WHERE id=%s", (order_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return (row[0], row[1]) if row else (None, None)


def publish_to_second(order_id: int, text: str):
    """Дублирует заказ во вторую группу (@UG_DRIVER) с той же кнопкой «Принять»."""
    chat2 = os.environ.get('DISPATCH_CHAT_ID_2', '')
    if not chat2:
        return
    res = tg_send(text, order_id, chat_id=chat2)
    if res.get('ok'):
        mid = (res.get('result') or {}).get('message_id')
        if mid:
            set_order_message2(order_id, chat2, mid)


def edit_second(order_id: int, text: str):
    """Обновляет сообщение заказа во второй группе, если оно есть."""
    chat2, mid2 = get_second_msg(order_id)
    if chat2 and mid2:
        tg_edit_order(mid2, text, order_id, chat_id=str(chat2))


def tg_edit(chat_id, message_id, text: str) -> dict:
    token = (os.environ.get('ZACAZU_BOT_TOKEN_NEW', '')
             or os.environ.get('ZACAZU_BOT_TOKEN', '')
             or os.environ.get('TELEGRAM_BOT_TOKEN', ''))
    if not token or not chat_id or not message_id:
        return {'ok': False, 'error': 'no creds/message'}
    payload = json.dumps({
        'chat_id': chat_id, 'message_id': message_id, 'text': text,
        'parse_mode': 'HTML', 'disable_web_page_preview': True,
        'reply_markup': {'inline_keyboard': []},
    }).encode()
    url = f"https://api.telegram.org/bot{token}/editMessageText"
    last_err = 'fail'
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, data=payload,
                                         headers={'Content-Type': 'application/json'}, method='POST')
            with urllib.request.urlopen(req, timeout=8) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            try:
                body = json.loads(e.read())
                desc = body.get('description', '')
                if 'message is not modified' in desc:
                    return {'ok': True, 'unchanged': True}
                return {'ok': False, 'error': f"HTTP {e.code}: {desc[:200]}"}
            except Exception:
                return {'ok': False, 'error': f"HTTP {e.code}"}
        except Exception as e:
            last_err = f"{type(e).__name__}: {str(e)[:200]}"
            if attempt < 2:
                time.sleep(2)
    return {'ok': False, 'error': last_err}


def cancel_order(order_id: int) -> dict:
    """Отмена заказа диспетчером: статус cancelled, пометка в группе (не удаляя)."""
    conn = db()
    cur = conn.cursor()
    cur.execute(
        f"SELECT tg_chat_id, tg_message_id, tg_message_text, from_city, to_city, "
        f"order_date, order_time, price, commission_rub FROM {SCHEMA}.dispatch_orders WHERE id=%s",
        (order_id,),
    )
    row = cur.fetchone()
    cur.execute(
        f"UPDATE {SCHEMA}.dispatch_orders SET sale_status='cancelled', "
        f"current_user_id=NULL, current_deadline=NULL WHERE id=%s",
        (order_id,),
    )
    conn.commit()
    cur.close()
    conn.close()
    if row and row[0] and row[1]:
        base = row[2] or '🚖 <b>ЗАКАЗ</b>'
        text = base + render_queue_block(order_id) + "\n\n━━━━━━━━━━━━━━━\n🚫 <b>Отменён диспетчером</b>"
        res1 = tg_edit(row[0], row[1], text)
        # Та же отметка во второй группе.
        chat2, mid2 = get_second_msg(order_id)
        res2 = tg_edit(chat2, mid2, text) if (chat2 and mid2) else {'ok': True, 'skipped': True}
        ok = bool(res1.get('ok'))
        return {'ok': ok, 'tg': res1, 'tg2': res2}
    return {'ok': True, 'no_message': True}


def handler(event: dict, context) -> dict:
    """Диспетчерская: action=send (в Telegram), archive_save, archive_list, archive_delete."""
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
        'Access-Control-Max-Age': '86400',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    qs = event.get('queryStringParameters') or {}
    action = (qs.get('action') or 'send').strip()

    if action == 'archive_list':
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps(archive_list())}

    if action == 'cleanup_unpaid':
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps(cleanup_unpaid())}

    if event.get('httpMethod') != 'POST':
        return {'statusCode': 405, 'headers': cors, 'body': json.dumps({'ok': False, 'error': 'method not allowed'})}

    try:
        data = json.loads(event.get('body') or '{}')
    except Exception:
        return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'ok': False, 'error': 'bad json'})}

    if action == 'archive_delete':
        oid = data.get('id')
        if not oid:
            return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'ok': False, 'error': 'no id'})}
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps(archive_delete(int(oid)))}

    if action == 'cancel':
        oid = data.get('id')
        if not oid:
            return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'ok': False, 'error': 'no id'})}
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps(cancel_order(int(oid)))}

    if action == 'update':
        if not data.get('id'):
            return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'ok': False, 'error': 'no id'})}
        if not has_content(data):
            return {'statusCode': 400, 'headers': cors,
                    'body': json.dumps({'ok': False, 'error': 'Заполни хотя бы маршрут или телефон клиента'})}
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps(update_order(data))}

    if not has_content(data):
        return {'statusCode': 400, 'headers': cors,
                'body': json.dumps({'ok': False, 'error': 'Заполни хотя бы маршрут или телефон клиента'})}

    if action == 'archive_save':
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps(archive_save(data))}

    # action == 'send' — публикация заказа на продажу с кнопкой «Принять заказ».
    commission_rub = calc_commission_rub(data.get('price'), data.get('commission'))

    def build_text(order_id: int) -> str:
        t = f"🔖 <b>Заказ #{order_id}</b>\n\n" + build_message(data)
        if commission_rub > 0:
            t += f"\n\n💳 <b>Комиссия за заказ:</b> {commission_rub:.0f} ₽"
        t += f"\n\n👉 Нажми «Принять заказ» и оплати комиссию в течение 5 минут.\n#заказ_{order_id}"
        return t

    # Уже опубликован и ещё продаётся → РЕДАКТИРУЕМ существующее сообщение в группе.
    if data.get('id'):
        msg_id, sale_status = get_published_state(int(data['id']))
        if msg_id and sale_status == 'selling':
            order_id = prepare_order_for_sale(data, clear_queue=False)
            text = build_text(order_id)
            set_order_message(order_id, msg_id, text)
            full = text + render_queue_block(order_id)
            edited = tg_edit_order(msg_id, full, order_id)
            edit_second(order_id, full)  # обновляем копию во 2-й группе
            if edited.get('ok'):
                return {'statusCode': 200, 'headers': cors,
                        'body': json.dumps({'ok': True, 'order_id': order_id, 'edited': True})}
            return {'statusCode': 200, 'headers': cors,
                    'body': json.dumps({'ok': False, 'error': edited.get('error', 'fail')})}

    order_id = prepare_order_for_sale(data)
    text = build_text(order_id)
    result = tg_send(text, order_id)
    if result.get('ok'):
        msg_id = (result.get('result') or {}).get('message_id')
        if msg_id:
            set_order_message(order_id, msg_id, text)
        publish_to_second(order_id, text)  # дублируем заказ во 2-ю группу
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'ok': True, 'order_id': order_id})}
    return {'statusCode': 200, 'headers': cors,
            'body': json.dumps({'ok': False, 'error': result.get('error', 'fail')})}