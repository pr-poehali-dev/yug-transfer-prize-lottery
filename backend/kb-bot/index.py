"""Telegram-бот базы знаний: по /start показывает кнопку «Список групп» и присылает список из базы знаний."""
import os
import json
import time
import datetime
import ssl
import http.client
import concurrent.futures
import hashlib
import uuid
import boto3
import psycopg2
import complaints
import payments

SCHEMA = 't_p67171637_yug_transfer_prize_l'
BUTTON_GROUPS = '📋 Список групп'
BUTTON_SUB = '💳 Моя подписка'
BUTTON_CHECK_DRIVER = '🚗 Проверить водителя'
BUTTON_CHECK_DISP = '🎧 Проверить диспетчера'
BUTTON_CHECK = '🔎 Проверить по базе'
BUTTON_COMPLAIN = '⚠️ Отправить жалобу'
COMPLAIN_PROMPT = 'На кого жалоба?'
CHECKS_ANY = {'prompt': 'Проверка по базе водителей и диспетчеров', 'who': 'Аккаунт', 'role': ''}
CHECKS = {
    'driver': {'button': BUTTON_CHECK_DRIVER, 'prompt': 'Проверка водителя', 'category': 'водител', 'who': 'Водитель', 'role': 'driver'},
    'disp': {'button': BUTTON_CHECK_DISP, 'prompt': 'Проверка диспетчера', 'category': 'диспетчер', 'who': 'Диспетчер', 'role': 'dispatcher'},
}
TG_HOSTS = ['149.154.167.220', '149.154.167.41', '149.154.167.99', '91.108.56.130', 'api.telegram.org']
CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token, X-Cron-Secret',
}
LAST_OK = {'host': ''}
RENEW_MARKUP = {'inline_keyboard': [[{'text': '🔄 Продлить подписку', 'callback_data': 'renew_sub'}]]}
MAIN_KEYBOARD = {'keyboard': [[{'text': BUTTON_CHECK}], [{'text': BUTTON_COMPLAIN}], [{'text': BUTTON_GROUPS}, {'text': BUTTON_SUB}]], 'resize_keyboard': True, 'is_persistent': True, 'input_field_placeholder': 'Поиск'}


def _call(host: str, method: str, data: bytes, timeout: float) -> dict:
    token = os.environ.get('KB_BOT_TOKEN', '')
    ctx = ssl.create_default_context()
    if host != 'api.telegram.org':
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    conn = http.client.HTTPSConnection(host, 443, timeout=timeout, context=ctx)
    try:
        conn.request('POST', f'/bot{token}/{method}', body=data,
                     headers={'Content-Type': 'application/json', 'Host': 'api.telegram.org'})
        return json.loads(conn.getresponse().read())
    finally:
        conn.close()


def tg_api(method: str, payload: dict, timeout: float = 3.5) -> dict:
    """Запрос к Telegram сразу по всем адресам параллельно — берём первый ответ."""
    data = json.dumps(payload).encode()
    hosts = [LAST_OK['host']] if LAST_OK['host'] else TG_HOSTS
    pool = concurrent.futures.ThreadPoolExecutor(max_workers=len(TG_HOSTS))
    futures = {pool.submit(_call, h, method, data, timeout): h for h in hosts}
    result = {}
    try:
        for fut in concurrent.futures.as_completed(futures, timeout=timeout + 0.3):
            try:
                result = fut.result()
                LAST_OK['host'] = futures[fut]
                break
            except Exception as e:
                print(f'[KB-BOT] {method} via {futures[fut]} failed: {type(e).__name__}')
    except concurrent.futures.TimeoutError:
        print(f'[KB-BOT] {method} timeout on all hosts')
    pool.shutdown(wait=False, cancel_futures=True)
    if not result and LAST_OK['host'] and hosts != TG_HOSTS:
        LAST_OK['host'] = ''
        return tg_api(method, payload, timeout)
    return result


def load_groups() -> list:
    """Записи базы знаний с разделом или заголовком про группы."""
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        cur.execute(
            f"SELECT title, content FROM {SCHEMA}.knowledge_base "
            f"WHERE category ILIKE '%групп%' OR title ILIKE '%групп%' ORDER BY id")
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()


TRIAL_DAYS = 3


def start_trial(user: dict) -> tuple:
    """Выдаёт пробный период один раз. Возвращает (дата окончания, выдан_сейчас)."""
    uid = int(user.get('id') or 0)
    if not uid:
        return None, False
    q = lambda v: str(v or '').replace("'", "''")
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        cur.execute(f"INSERT INTO {SCHEMA}.kb_subscriptions (tg_user_id, username, first_name, active_until, is_trial) "
                    f"VALUES ({uid}, '{q(user.get('username'))}', '{q(user.get('first_name'))}', "
                    f"NOW() + interval '{TRIAL_DAYS} days', TRUE) ON CONFLICT (tg_user_id) DO NOTHING RETURNING active_until")
        row = cur.fetchone()
        if row:
            conn.commit()
            return row[0], True
        cur.execute(f"SELECT active_until FROM {SCHEMA}.kb_subscriptions WHERE tg_user_id={uid}")
        r = cur.fetchone()
        return (r[0] if r else None), False
    finally:
        cur.close()
        conn.close()


ROLE_MARKUP = {'inline_keyboard': [[{'text': '🚗 Я водитель', 'callback_data': 'myrole:driver'},
                                     {'text': '🎧 Я диспетчер', 'callback_data': 'myrole:dispatcher'}]]}
ROLE_NAMES = {'driver': '🚗 Водитель', 'dispatcher': '🎧 Диспетчер'}


def get_role(uid: int) -> str:
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        cur.execute(f"SELECT role FROM {SCHEMA}.kb_subscriptions WHERE tg_user_id={int(uid)}")
        r = cur.fetchone()
        return (r[0] if r else '') or ''
    finally:
        cur.close()
        conn.close()


def swap_start_msg(uid: int, new_id) -> int:
    """Запоминает id нового приветствия и возвращает id прошлого, чтобы его удалить."""
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        cur.execute(f"SELECT start_msg_id FROM {SCHEMA}.kb_subscriptions WHERE tg_user_id={int(uid)}")
        r = cur.fetchone()
        old = (r[0] if r else 0) or 0
        cur.execute(f"UPDATE {SCHEMA}.kb_subscriptions SET start_msg_id={int(new_id) if new_id else 'NULL'} "
                    f"WHERE tg_user_id={int(uid)}")
        conn.commit()
        return int(old)
    finally:
        cur.close()
        conn.close()


def send_single(chat_id, uid: int, payload: dict) -> None:
    """Отправляет одно сообщение бота вместо прошлого: старое приветствие удаляется."""
    res = tg_api('sendMessage', {'chat_id': chat_id, 'parse_mode': 'HTML', **payload})
    new_id = (res.get('result') or {}).get('message_id')
    old = swap_start_msg(uid, new_id) if new_id else 0
    if old and old != new_id:
        tg_api('deleteMessage', {'chat_id': chat_id, 'message_id': old}, timeout=2.2)


def handle_my_role(callback: dict) -> None:
    role = str(callback.get('data') or '').split(':', 1)[1]
    user = callback.get('from') or {}
    msg = callback.get('message') or {}
    chat_id = (msg.get('chat') or {}).get('id') or user.get('id')
    if role not in ROLE_NAMES or not user.get('id'):
        return
    until, _ = start_trial(user)
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        cur.execute(f"UPDATE {SCHEMA}.kb_subscriptions SET role='{role}', updated_at=now() WHERE tg_user_id={int(user['id'])}")
        cur.execute(f"UPDATE {SCHEMA}.check_lists SET role='{role}', auto_white=FALSE, updated_at=now() "
                    f"WHERE tg_id={int(user['id'])} AND auto_white AND list_type='white'")
        conn.commit()
    finally:
        cur.close()
        conn.close()
    tg_api('answerCallbackQuery', {'callback_query_id': callback.get('id'), 'text': 'Роль сохранена'}, timeout=2.2)
    if msg.get('message_id'):
        tg_api('deleteMessage', {'chat_id': chat_id, 'message_id': msg['message_id']}, timeout=2.2)
    till = f'\n🎁 Доступ до: <b>{until.strftime("%d.%m.%Y %H:%M")}</b>' if until else ''
    send_single(chat_id, user['id'], {
        'reply_markup': MAIN_KEYBOARD,
        'text': f'✅ Ваша роль: <b>{ROLE_NAMES[role]}</b>{till}\n'
                + ('🎧 Для диспетчеров поиск и проверка — <b>бесплатно</b> всегда. Список групп — по подписке.\n' if role == 'dispatcher' else '')
                + '\n'
                '🔎 Отправьте @username, номер телефона или ID — бот покажет, что о человеке известно.',
    })


def ask_role(chat_id, uid: int) -> None:
    send_single(chat_id, uid, {'text': '👤 <b>Выберите свою роль:</b>', 'reply_markup': ROLE_MARKUP})


def send_welcome(chat_id, user: dict, start_msg_id=None) -> None:
    uid = int(user.get('id') or 0)
    if start_msg_id:
        tg_api('deleteMessage', {'chat_id': chat_id, 'message_id': start_msg_id}, timeout=2.2)
    until, fresh = start_trial(user)
    name = esc_html(user.get('first_name') or '')
    hello = f'👋 Здравствуйте{", " + name if name else ""}!'
    role = get_role(uid)
    active = bool(until and until > datetime.datetime.now())
    if not active and not fresh and role != 'dispatcher':
        send_single(chat_id, uid, {'reply_markup': RENEW_MARKUP,
                                   'text': f'{hello}\n\n🔎 Поиск работает <b>по подписке</b>.\n'
                                           '⏳ Тестовый период закончился — продлите подписку, чтобы продолжить.'})
        return
    till = until.strftime("%d.%m.%Y %H:%M") if until else ''
    if role == 'dispatcher' and not active:
        send_single(chat_id, uid, {'reply_markup': MAIN_KEYBOARD, 'text': (
            f'{hello} Ваша роль: <b>🎧 Диспетчер</b>\n\n'
            '🔎 Поиск и проверка для диспетчеров — <b>бесплатно</b>: отправьте @username, телефон или ID.\n'
            '🔒 Список групп — по подписке.')})
        return
    if not role:
        send_single(chat_id, uid, {'reply_markup': ROLE_MARKUP, 'text': (
            f'{hello}\n\n'
            '🔎 Система поиска водителей и диспетчеров работает <b>по подписке</b>.\n'
            f'🎁 У вас <b>{TRIAL_DAYS} дня бесплатно</b> — до <b>{till}</b>.\n\n'
            '👤 <b>Выберите свою роль:</b>')})
        return
    send_single(chat_id, uid, {'reply_markup': MAIN_KEYBOARD, 'text': (
        f'{hello} Ваша роль: <b>{ROLE_NAMES.get(role, role)}</b>\n'
        + ('🎧 Для диспетчеров поиск и проверка — <b>бесплатно</b>. Список групп — по подписке.\n' if role == 'dispatcher' else '') +
        f'✅ Доступ до: <b>{till}</b>\n\n'
        '🔎 Отправьте @username, номер телефона или ID для проверки.')})


def send_subscription(chat_id, user_id) -> None:
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        cur.execute(
            f"SELECT active_until, active_until > NOW(), is_trial FROM {SCHEMA}.kb_subscriptions "
            f"WHERE tg_user_id = {int(user_id)}")
        row = cur.fetchone()
    finally:
        cur.close()
        conn.close()

    if not row or not row[0]:
        text = '💳 <b>Моя подписка</b>\n\nУ вас пока нет подписки.'
    elif row[1]:
        until = row[0].strftime('%d.%m.%Y %H:%M')
        kind = 'Тестовый период' if row[2] else 'Активна'
        text = f'💳 <b>Моя подписка</b>\n\n✅ {kind}\n📅 Действует до: <b>{until}</b>'
    else:
        until = row[0].strftime('%d.%m.%Y')
        text = f'💳 <b>Моя подписка</b>\n\n❌ Закончилась {until}'
    tg_api('sendMessage', {'chat_id': chat_id, 'text': text, 'parse_mode': 'HTML',
                           'reply_markup': RENEW_MARKUP})


def sub_active(uid: int) -> bool:
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        cur.execute(f"SELECT active_until > NOW() FROM {SCHEMA}.kb_subscriptions WHERE tg_user_id={int(uid)}")
        r = cur.fetchone()
        return bool(r and r[0])
    finally:
        cur.close()
        conn.close()


def can_check(uid: int) -> bool:
    """Проверка людей: диспетчерам бесплатно, остальным — по подписке."""
    return get_role(uid) == 'dispatcher' or sub_active(uid)


def send_paywall(chat_id, what: str) -> None:
    tg_api('sendMessage', {'chat_id': chat_id, 'parse_mode': 'HTML', 'reply_markup': RENEW_MARKUP,
                           'text': f'🔒 <b>{what}</b> доступен только по подписке.\n\n'
                                   'Оформите подписку, чтобы открыть доступ.'})


BOT_LINK = {'url': ''}


def bot_link() -> str:
    if not BOT_LINK['url']:
        me = tg_api('getMe', {}, timeout=2.2).get('result') or {}
        BOT_LINK['url'] = f"https://t.me/{me['username']}" if me.get('username') else 'https://t.me'
    return BOT_LINK['url']


def handle_renew(callback: dict) -> None:
    user_id = (callback.get('from') or {}).get('id')
    chat_id = ((callback.get('message') or {}).get('chat') or {}).get('id') or user_id
    tg_api('answerCallbackQuery', {'callback_query_id': callback.get('id')}, timeout=2.2)
    tg_api('sendMessage', {'chat_id': chat_id, 'parse_mode': 'HTML', 'reply_markup': payments.PLANS_MARKUP,
                           'text': '💳 <b>Выберите тариф</b>\n\n'
                                   'Подписка открывает список групп и поиск по базе.\n'
                                   'Если подписка ещё действует — новый срок добавится к текущему.'})


def handle_buy(callback: dict) -> None:
    user_id = (callback.get('from') or {}).get('id')
    chat_id = ((callback.get('message') or {}).get('chat') or {}).get('id') or user_id
    plan_key = str(callback.get('data')).split(':', 1)[1]
    if plan_key not in payments.PLANS:
        tg_api('answerCallbackQuery', {'callback_query_id': callback.get('id')}, timeout=2.2)
        return
    url, pid = payments.create(user_id, chat_id, plan_key, bot_link())
    if not url:
        tg_api('answerCallbackQuery', {'callback_query_id': callback.get('id'),
                                       'text': 'Оплата временно недоступна, попробуйте позже', 'show_alert': True}, timeout=2.2)
        return
    tg_api('answerCallbackQuery', {'callback_query_id': callback.get('id')}, timeout=2.2)
    plan = payments.PLANS[plan_key]
    tg_api('sendMessage', {'chat_id': chat_id, 'parse_mode': 'HTML',
                           'text': f"💳 Подписка на <b>{plan['title']}</b> — <b>{plan['price']} ₽</b>\n\n"
                                   'Нажмите «Оплатить». После оплаты подписка включится автоматически.',
                           'reply_markup': {'inline_keyboard': [
                               [{'text': f"Оплатить {plan['price']} ₽", 'url': url}],
                               [{'text': '✅ Я оплатил', 'callback_data': f'paid:{pid}'}]]}})


def notify_paid(res: dict) -> None:
    if res.get('new') and res.get('chat_id'):
        plan = payments.PLANS.get(res.get('plan'), {})
        tg_api('sendMessage', {'chat_id': res['chat_id'], 'parse_mode': 'HTML', 'reply_markup': MAIN_KEYBOARD,
                               'text': f"✅ Оплата получена — подписка на <b>{plan.get('title', '')}</b> активна.\n"
                                       f"📅 Действует до: <b>{res.get('until', '')}</b>"})


def handle_paid(callback: dict) -> None:
    res = payments.confirm(str(callback.get('data')).split(':', 1)[1])
    st = res.get('status')
    if st == 'succeeded':
        tg_api('answerCallbackQuery', {'callback_query_id': callback.get('id'),
                                       'text': f"Подписка активна до {res.get('until', '')}"}, timeout=2.2)
        notify_paid(res)
    else:
        text = 'Платёж отменён — выберите тариф заново' if st == 'canceled' else 'Оплата ещё не поступила. Подождите минуту и нажмите снова.'
        tg_api('answerCallbackQuery', {'callback_query_id': callback.get('id'), 'text': text, 'show_alert': True}, timeout=2.2)


def handle_yookassa(event: dict) -> dict:
    """Уведомление от ЮKassa: статус не доверяем, перепроверяем платёж через API."""
    body = json.loads(event.get('body') or '{}')
    pid = (body.get('object') or {}).get('id', '')
    if pid:
        notify_paid(payments.confirm(pid))
    return {'statusCode': 200, 'headers': CORS, 'body': 'ok'}


def ask_check(chat_id, kind: str) -> None:
    c = CHECKS.get(kind) or CHECKS_ANY
    tg_api('sendMessage', {
        'chat_id': chat_id,
        'text': f"🔎 {c['prompt']}\n\nОтправьте ответом на это сообщение @username, Telegram ID или номер телефона.",
        'reply_markup': {'force_reply': True, 'input_field_placeholder': '@username, ID или телефон'},
    })


def classify_query(q: str):
    """Определяет, что прислали: ('id', 123), ('phone', '9181234567') или ('username', 'name').
    Понимает tg://user?id=..., tg://resolve?domain=..., ссылки t.me / telegram.me, @username, ID и номер."""
    import re
    q = q.strip()
    m = re.search(r'tg://(?:user|openmessage)\?(?:user_)?id=(\d+)', q, re.I)
    if m:
        return 'id', int(m.group(1))
    m = re.search(r'tg://resolve\?domain=([A-Za-z0-9_]+)', q, re.I)
    if m:
        return 'username', m.group(1).lower()
    m = re.search(r'(?:https?://)?(?:www\.)?(?:t\.me|telegram\.me|telegram\.dog)/(?:@)?([A-Za-z0-9_]+)', q, re.I)
    if m:
        return 'username', m.group(1).lower()
    if q.startswith('@'):
        return 'username', q[1:].lower()
    compact = re.sub(r'[\s\-()]', '', q)
    if compact.lstrip('+').isdigit():
        digits = compact.lstrip('+')
        if compact.startswith('+') or (len(digits) == 11 and digits[0] in '78') or len(digits) == 10 and digits[0] == '9':
            return 'phone', digits[-10:]
        return 'id', int(digits)
    return 'username', q.lower()


def looks_like_person(q: str) -> bool:
    """Запрос похож на ссылку на человека (а не на текст для базы знаний)."""
    import re
    q = q.strip()
    return bool(re.match(r'(tg://|https?://(www\.)?(t\.me|telegram\.me)/|t\.me/|@[A-Za-z0-9_]{3,}$|\+?[\d\s\-()]{7,}$)', q, re.I))


def save_tg_user(user: dict, source: str) -> None:
    """Запоминаем Telegram ID, @username и имя каждого, кого видит бот."""
    if not user or user.get('is_bot') or not user.get('id'):
        return
    un = str(user.get('username') or '').replace("'", "''")
    fn = str(user.get('first_name') or '').replace("'", "''")
    ln = str(user.get('last_name') or '').replace("'", "''")
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        cur.execute(
            f"INSERT INTO {SCHEMA}.tg_users (tg_id, username, first_name, last_name, source) "
            f"VALUES ({int(user['id'])}, '{un}', '{fn}', '{ln}', '{source}') "
            f"ON CONFLICT (tg_id) DO UPDATE SET username=EXCLUDED.username, first_name=EXCLUDED.first_name, "
            f"last_name=EXCLUDED.last_name, updated_at=now()")
        if un:
            cur.execute(
                f"UPDATE {SCHEMA}.check_lists SET tg_id={int(user['id'])} "
                f"WHERE tg_id IS NULL AND lower(username)=lower('{un}')")
        conn.commit()
    finally:
        cur.close()
        conn.close()


def run_check(chat_id, kind: str, query: str) -> None:
    c = CHECKS.get(kind) or CHECKS_ANY
    kind_q, q = classify_query(query)
    if kind_q == 'username' and len(q) < 3:
        tg_api('sendMessage', {'chat_id': chat_id, 'text': 'Слишком короткий запрос. Попробуйте ещё раз.',
                               'reply_markup': MAIN_KEYBOARD})
        return
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        known = None
        if kind_q == 'id':
            cur.execute(f"SELECT tg_id, username FROM {SCHEMA}.tg_users WHERE tg_id={q}")
            known = cur.fetchone()
        elif kind_q == 'username':
            qe = q.replace("'", "''")
            cur.execute(f"SELECT tg_id, username FROM {SCHEMA}.tg_users WHERE lower(username)='{qe}' "
                        f"ORDER BY updated_at DESC LIMIT 1")
            known = cur.fetchone()

        conds = []
        if kind_q == 'id':
            conds.append(f"tg_id = {q}")
            if known and known[1]:
                conds.append(f"lower(username) = lower('{known[1].replace(chr(39), chr(39) * 2)}')")
        elif kind_q == 'phone':
            conds.append(f"right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = '{q}'")
        else:
            qe = q.replace("'", "''")
            conds.append(f"lower(username) = '{qe}'")
            if known:
                conds.append(f"tg_id = {int(known[0])}")
        role_cond = f"role = '{c['role']}' AND " if c['role'] else "list_type <> 'pending' AND "
        cur.execute(
            f"SELECT list_type, name, username, phone, note, tg_id, photo_url, reason, removed_at, id, role "
            f"FROM {SCHEMA}.check_lists "
            f"WHERE {role_cond}({' OR '.join(conds)}) "
            f"ORDER BY CASE list_type WHEN 'black' THEN 0 ELSE 1 END, id DESC LIMIT 5")
        rows = cur.fetchall()
    finally:
        cur.close()
        conn.close()

    shown = esc_html(query.strip())
    found = [r for r in rows if r[0] in ('black', 'white')]
    if not found:
        live = live_lookup(kind_q, q) if not known else {}
        if live:
            known = (int(live['tg_id']), live.get('username') or '')
        add_to_moderation(kind_q, q, known, live)
        head = (f"⚠️ <b>Будьте внимательны!</b>\n\n"
                f"У нас ещё нет информации о данном участнике <b>{shown}</b>.\n"
                f"Мы взяли его на проверку — данные появятся после модерации.")
        if live:
            info = [f"👤 {esc_html(live.get('name') or '—')}"]
            if live.get('username'):
                info.append(f"🔗 @{esc_html(live['username'])}")
            info.append(f"🆔 <code>{int(live['tg_id'])}</code>")
            if live.get('phone'):
                info.append(f"📞 {esc_html(live['phone'])}")
            if live.get('bio'):
                info.append(f"📝 {esc_html(str(live['bio'])[:300])}")
            head += "\n\n<b>Данные из Telegram:</b>\n" + "\n".join(info)
        tg_api('sendMessage', {'chat_id': chat_id, 'text': head, 'parse_mode': 'HTML',
                               'reply_markup': MAIN_KEYBOARD})
        return
    found.sort(key=lambda r: 0 if r[0] == 'black' else 1)
    for r in found[:3]:
        send_card(chat_id, r, verdict(r))


LOOKUP_URL = 'https://functions.poehali.dev/cc462dc8-83da-48a4-86f1-db3d0501d54a'
DEADLINE = {'t': 0.0}


def live_lookup(kind_q: str, q) -> dict:
    """Живой поиск в Telegram через аккаунт бота (сканер), если человека ещё нет в базе."""
    if kind_q not in ('username', 'phone'):
        return {}
    left = min(12.0, DEADLINE['t'] - time.time() - 1.5) if DEADLINE['t'] else 2.0
    if left < 3:
        return {}
    import urllib.request
    import urllib.parse
    param = {'username': q} if kind_q == 'username' else {'phone': f'7{q}'}
    req = urllib.request.Request(f"{LOOKUP_URL}?{urllib.parse.urlencode(param)}",
                                 headers={'X-Cron-Secret': os.environ.get('CRON_SECRET', '')})
    try:
        with urllib.request.urlopen(req, timeout=left) as r:
            d = json.loads(r.read().decode() or '{}')
        return d if d.get('ok') and d.get('tg_id') else {}
    except Exception as e:
        print(f'[KB-BOT] live lookup: {type(e).__name__}')
        return {}


def add_to_moderation(kind_q: str, q, known, live: dict = None) -> None:
    """Неизвестный аккаунт из запроса сразу попадает «На модерацию» — сразу с данными из Telegram, если они найдены.
    Если карточка уже есть, пустые поля дополняются, ничего не затирается."""
    live = live or {}
    e = lambda v: str(v or '').replace("'", "''")
    tg_id = int(q) if kind_q == 'id' else (int(known[0]) if known else None)
    username = (known[1] if known and known[1] else '') if kind_q == 'id' else (q if kind_q == 'username' else '')
    username = (live.get('username') or username or '').lstrip('@')
    phone = live.get('phone') or (f"+7{q}" if kind_q == 'phone' else '')
    name, bio, photo, photo_uid = live.get('name') or '', live.get('bio') or '', live.get('photo_url') or '', str(live.get('photo_uid') or '')
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        conds = []
        if tg_id:
            conds.append(f"tg_id={tg_id}")
        if username:
            conds.append(f"lower(username)=lower('{e(username)}')")
        if kind_q == 'phone':
            conds.append(f"right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = '{q}'")
        if not conds:
            return
        cur.execute(f"SELECT id FROM {SCHEMA}.check_lists WHERE {' OR '.join(conds)} ORDER BY id LIMIT 1")
        row = cur.fetchone()
        scan = "last_scan_at=now(), scan_status='ok'" if live else ''
        if row:
            if not live:
                return
            sets = [f"tg_id=COALESCE(tg_id, {tg_id})" if tg_id else '',
                    f"username=CASE WHEN username='' THEN '{e(username)}' ELSE username END" if username else '',
                    f"name=CASE WHEN name='' THEN '{e(name)}' ELSE name END" if name else '',
                    f"phone=CASE WHEN phone='' THEN '{e(phone)}' ELSE phone END" if phone else '',
                    f"bio=CASE WHEN coalesce(bio,'')='' THEN '{e(bio)}' ELSE bio END" if bio else '',
                    f"photo_url=CASE WHEN coalesce(photo_url,'')='' THEN '{e(photo)}' ELSE photo_url END" if photo else '',
                    f"photo_file_uid=CASE WHEN coalesce(photo_file_uid,'')='' THEN '{e(photo_uid)}' ELSE photo_file_uid END" if photo_uid else '',
                    scan, "updated_at=now()"]
            cur.execute(f"UPDATE {SCHEMA}.check_lists SET {', '.join(x for x in sets if x)} WHERE id={int(row[0])}")
        else:
            cur.execute(
                f"INSERT INTO {SCHEMA}.check_lists (role, list_type, name, username, phone, note, tg_id, source, bio, "
                f"photo_url, photo_file_uid, last_scan_at, scan_status) "
                f"VALUES ('', 'pending', '{e(name)}', '{e(username)}', '{e(phone)}', '', "
                f"{tg_id if tg_id else 'NULL'}, 'запрос в боте', '{e(bio)}', '{e(photo)}', '{e(photo_uid)}', "
                f"{'now()' if live else 'NULL'}, '{'ok' if live else ''}') ON CONFLICT DO NOTHING")
        conn.commit()
    except Exception as ex:
        print(f'[KB-BOT] add to moderation failed: {type(ex).__name__}: {str(ex)[:150]}')
    finally:
        cur.close()
        conn.close()


def ask_complaint_target(chat_id) -> None:
    tg_api('sendMessage', {
        'chat_id': chat_id, 'parse_mode': 'HTML',
        'text': f"⚠️ <b>{COMPLAIN_PROMPT}</b>\n\nОтправьте ответом на это сообщение @username, Telegram ID, "
                f"ссылку на профиль или номер телефона водителя / диспетчера.",
        'reply_markup': {'force_reply': True, 'input_field_placeholder': '@username, ID или телефон'},
    })


def find_card_id(kind_q: str, q):
    conds = []
    if kind_q == 'id':
        conds.append(f"tg_id = {int(q)}")
    elif kind_q == 'phone':
        conds.append(f"right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = '{q}'")
    else:
        conds.append(f"lower(username) = '{str(q).replace(chr(39), chr(39) * 2)}'")
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        cur.execute(f"SELECT id FROM {SCHEMA}.check_lists WHERE {' OR '.join(conds)} "
                    f"ORDER BY CASE list_type WHEN 'black' THEN 0 WHEN 'white' THEN 1 ELSE 2 END, id LIMIT 1")
        r = cur.fetchone()
        return int(r[0]) if r else None
    finally:
        cur.close()
        conn.close()


def run_complaint_target(chat_id, user: dict, query: str) -> None:
    """Находит (или заводит на модерацию) карточку по запросу и запускает оформление жалобы."""
    kind_q, q = classify_query(query)
    if kind_q == 'username' and (len(q) < 3 or ' ' in q):
        tg_api('sendMessage', {'chat_id': chat_id, 'reply_markup': MAIN_KEYBOARD,
                               'text': 'Не понял, на кого жалоба. Нажмите «⚠️ Отправить жалобу» и пришлите @username, ID или телефон.'})
        return
    item_id = find_card_id(kind_q, q)
    if not item_id:
        known = None
        if kind_q in ('id', 'username'):
            conn = psycopg2.connect(os.environ['DATABASE_URL'])
            cur = conn.cursor()
            cond = f"tg_id={int(q)}" if kind_q == 'id' else f"lower(username)='{str(q).replace(chr(39), chr(39) * 2)}'"
            cur.execute(f"SELECT tg_id, username FROM {SCHEMA}.tg_users WHERE {cond} ORDER BY updated_at DESC LIMIT 1")
            known = cur.fetchone()
            cur.close()
            conn.close()
        live = live_lookup(kind_q, q) if not known else {}
        if live:
            known = (int(live['tg_id']), live.get('username') or '')
        add_to_moderation(kind_q, q, known, live)
        item_id = find_card_id(kind_q, q)
        if not item_id and known:
            item_id = find_card_id('id', known[0])
    if not item_id:
        tg_api('sendMessage', {'chat_id': chat_id, 'reply_markup': MAIN_KEYBOARD,
                               'text': 'Не удалось найти этот аккаунт. Проверьте @username, ID или телефон и попробуйте ещё раз.'})
        return
    complaints.start_for(tg_api, user, chat_id, item_id)


def verdict(r) -> str:
    """Итог проверки: кто это (водитель/диспетчер) и можно ли с ним работать."""
    list_type, role = r[0], (r[10] if len(r) > 10 else '')
    who = {'driver': '🚗 Это ВОДИТЕЛЬ', 'dispatcher': '🎧 Это ДИСПЕТЧЕР'}.get(role, '👤 Аккаунт')
    if list_type == 'black':
        return f"⛔️ <b>ЧЁРНЫЙ СПИСОК</b>\n{who}\n\n❌ Работать НЕ рекомендуем!"
    return f"✅ <b>БЕЛЫЙ СПИСОК</b>\n{who}\n\n👍 Проверен — с ним можно работать."


def card_text(r, head: str) -> str:
    list_type, name, username, phone, note, tg_id, photo_url, reason, removed_at, item_id = r[:10]
    lines = [head, ''] if head else []
    lines.append(f"👤 <b>{esc_html(name) or 'Без имени'}</b>")
    if tg_id:
        lines.append(f"🆔 ID: <code>{tg_id}</code>")
    if phone:
        lines.append(f"📞 {esc_html(phone)}")
    if username:
        lines.append(f"🔗 @{esc_html(username)}")
    if list_type == 'black':
        if reason:
            lines.append(f"\n⛔️ <b>За что:</b> {esc_html(reason)[:800]}")
        if removed_at:
            lines.append(f"📅 <b>Когда удалён:</b> {removed_at.strftime('%d.%m.%Y')}")
    if list_type == 'black':
        cnt = complaints.complaints_count(item_id)
        if cnt:
            lines.append(f"📣 Жалоб от участников: <b>{cnt}</b>")
    if note:
        lines.append(f"\n📝 {esc_html(note)[:800]}")
    hist = load_history(item_id)
    if hist:
        lines.append('\n🔄 <b>Изменения в аккаунте:</b>')
        for field, old, new, changed_at in hist:
            lines.append(f"• {changed_at.strftime('%d.%m.%Y')} {FIELD_NAMES.get(field, field)}: "
                         f"{esc_html(old) or '—'} → {esc_html(new) or '—'}")
    return '\n'.join(lines)


FIELD_NAMES = {'name': 'имя', 'username': 'username', 'bio': 'описание', 'photo_url': 'фото', 'phone': 'телефон'}


def load_history(item_id) -> list:
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        cur.execute(f"SELECT field, left(old_value, 60), left(new_value, 60), changed_at "
                    f"FROM {SCHEMA}.check_list_history WHERE item_id={int(item_id)} AND source='scan' "
                    f"ORDER BY changed_at DESC LIMIT 5")
        return [(f, '' if f == 'photo_url' else o, 'обновлено' if f == 'photo_url' else n, d)
                for f, o, n, d in cur.fetchall()]
    finally:
        cur.close()
        conn.close()


NO_PHOTO_URL = 'https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/cc06515e-5e65-4cde-b02f-d24b1889abb4.jpg'


def send_card(chat_id, r, head: str) -> None:
    """Карточка всегда уходит одним сообщением с фото: своё фото аккаунта или заглушка."""
    text = card_text(r, head)
    markup = complaints.complain_button(r[9])
    photo_url = r[6] or NO_PHOTO_URL
    if len(text) > 1024:
        # Подпись к фото ограничена — режем длинные блоки (описание, история), основное остаётся.
        text = text[:1000].rsplit('\n', 1)[0] + '\n…'
    for photo in dict.fromkeys([photo_url, NO_PHOTO_URL]):
        res = tg_api('sendPhoto', {'chat_id': chat_id, 'photo': photo, 'caption': text,
                                   'parse_mode': 'HTML', 'reply_markup': markup})
        if res.get('ok'):
            return
    tg_api('sendMessage', {'chat_id': chat_id, 'text': text[:4000], 'parse_mode': 'HTML',
                           'disable_web_page_preview': True, 'reply_markup': markup})


def run_search(chat_id, query: str) -> None:
    if looks_like_person(query):
        run_check(chat_id, 'any', query)
        return
    q = query.strip().replace("'", "''").replace('%', '')
    if len(q) < 2:
        tg_api('sendMessage', {'chat_id': chat_id, 'text': 'Выберите пункт меню 👇', 'reply_markup': MAIN_KEYBOARD})
        return
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        cur.execute(
            f"SELECT title, content FROM {SCHEMA}.knowledge_base "
            f"WHERE (title || ' ' || category || ' ' || content) ILIKE '%{q}%' ORDER BY id LIMIT 5")
        rows = cur.fetchall()
    finally:
        cur.close()
        conn.close()
    if not rows:
        text = f'🔍 По запросу «{esc_html(query.strip())}» ничего не найдено.'
    else:
        parts = [f'🔍 Найдено по запросу «{esc_html(query.strip())}»:']
        for title, content in rows:
            parts.append(f'\n<b>{esc_html(title)}</b>\n{esc_html(content)[:1500]}')
        text = '\n'.join(parts)
    tg_api('sendMessage', {'chat_id': chat_id, 'text': text[:4000], 'parse_mode': 'HTML',
                           'disable_web_page_preview': True, 'reply_markup': MAIN_KEYBOARD})


def esc_html(s: str) -> str:
    return (s or '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def send_groups(chat_id) -> None:
    rows = load_groups()
    if not rows:
        tg_api('sendMessage', {'chat_id': chat_id, 'text': 'Список групп пока пуст.',
                               'reply_markup': MAIN_KEYBOARD})
        return
    parts = []
    for title, content in rows:
        parts.append(f"<b>{esc_html(title)}</b>\n{esc_html(content)}".strip())
    text = '\n\n'.join(parts)
    for i in range(0, len(text), 4000):
        tg_api('sendMessage', {'chat_id': chat_id, 'text': text[i:i + 4000], 'parse_mode': 'HTML',
                               'disable_web_page_preview': True, 'reply_markup': MAIN_KEYBOARD})


def verify_admin(token: str) -> bool:
    if not token:
        return False
    a = hashlib.sha256(f"{os.environ.get('ADMIN_LOGIN', '')}:{os.environ.get('ADMIN_PASSWORD', '')}:admin_secret_2026".encode()).hexdigest()
    pl = os.environ.get('POSTS_LOGIN', '')
    p = hashlib.sha256(f"{pl}:{os.environ.get('POSTS_PASSWORD', '')}:posts_secret_2026".encode()).hexdigest()
    return token == a or (bool(pl) and token == p)


def tg_download(file_id: str) -> bytes:
    info = tg_api('getFile', {'file_id': file_id}, timeout=3)
    path = (info.get('result') or {}).get('file_path')
    if not path:
        return b''
    token = os.environ.get('KB_BOT_TOKEN', '')
    host = LAST_OK['host'] or 'api.telegram.org'
    ctx = ssl.create_default_context()
    if host != 'api.telegram.org':
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    conn = http.client.HTTPSConnection(host, 443, timeout=4, context=ctx)
    try:
        conn.request('GET', f'/file/bot{token}/{path}', headers={'Host': 'api.telegram.org'})
        return conn.getresponse().read()
    finally:
        conn.close()


def store_photo(raw: bytes) -> str:
    key = f"check-lists/scan-{uuid.uuid4().hex}.jpg"
    s3 = boto3.client('s3', endpoint_url='https://bucket.poehali.dev',
                      aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
                      aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'])
    s3.put_object(Bucket='files', Key=key, Body=raw, ContentType='image/jpeg')
    return f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"


def fetch_profile(tg_id: int) -> dict:
    """Текущие данные аккаунта из Telegram. Работает для тех, кого бот «видел»."""
    res = tg_api('getChat', {'chat_id': tg_id}, timeout=3)
    if not res.get('ok'):
        return {'error': res.get('description') or 'нет связи с Telegram'}
    ch = res.get('result') or {}
    photo = ch.get('photo') or {}
    return {
        'name': ' '.join(x for x in [ch.get('first_name', ''), ch.get('last_name', '')] if x).strip(),
        'username': ch.get('username', '') or '',
        'bio': ch.get('bio', '') or '',
        'photo_uid': photo.get('big_file_unique_id', '') or '',
        'photo_file_id': photo.get('big_file_id', '') or '',
    }


def scan_item(item_id: int) -> dict:
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        cur.execute(f"SELECT tg_id, name, username, bio, photo_url, photo_file_uid, last_scan_at "
                    f"FROM {SCHEMA}.check_lists WHERE id={int(item_id)}")
        row = cur.fetchone()
        if not row:
            return {'id': item_id, 'status': 'not_found'}
        tg_id, name, username, bio, photo_url, photo_uid, last_scan = row
        if not tg_id:
            cur.execute(f"UPDATE {SCHEMA}.check_lists SET last_scan_at=now(), scan_status='нет Telegram ID' WHERE id={int(item_id)}")
            conn.commit()
            return {'id': item_id, 'status': 'no_id'}

        prof = fetch_profile(int(tg_id))
        if prof.get('error'):
            st = 'аккаунт недоступен боту' if 'not found' in prof['error'].lower() else prof['error'][:100]
            cur.execute(f"UPDATE {SCHEMA}.check_lists SET last_scan_at=now(), scan_status='{st.replace(chr(39), chr(39) * 2)}' WHERE id={int(item_id)}")
            conn.commit()
            return {'id': item_id, 'status': 'error', 'error': st}

        first_scan = last_scan is None
        changes = []
        sets = []

        def track(field, old, new):
            if (old or '') != (new or ''):
                if not first_scan:
                    changes.append((field, old or '', new or ''))
                sets.append(f"{field}='{(new or '').replace(chr(39), chr(39) * 2)}'")

        if prof['name'] and not (first_scan and name):
            track('name', name, prof['name'])
        track('username', username, prof['username'])
        track('bio', bio, prof['bio'])
        if prof['photo_uid'] and prof['photo_uid'] != photo_uid:
            raw = tg_download(prof['photo_file_id'])
            if raw:
                new_url = store_photo(raw)
                if photo_uid and not first_scan:
                    changes.append(('photo_url', photo_url or '', new_url))
                sets.append(f"photo_url='{new_url}'")
                sets.append(f"photo_file_uid='{prof['photo_uid']}'")

        for field, old, new in changes:
            cur.execute(
                f"INSERT INTO {SCHEMA}.check_list_history (item_id, field, old_value, new_value, source) "
                f"VALUES ({int(item_id)}, '{field}', '{old.replace(chr(39), chr(39) * 2)}', "
                f"'{new.replace(chr(39), chr(39) * 2)}', 'scan')")
        status = f"изменений: {len(changes)}" if changes else 'без изменений'
        sets += ['last_scan_at=now()', f"scan_status='{status}'"]
        cur.execute(f"UPDATE {SCHEMA}.check_lists SET {', '.join(sets)} WHERE id={int(item_id)}")
        if changes:
            fields = ','.join(dict.fromkeys(f for f, _, _ in changes))
            cur.execute(
                f"INSERT INTO {SCHEMA}.check_list_snapshots "
                f"(item_id, tg_id, name, username, phone, bio, photo_url, source, changed_fields) "
                f"SELECT id, tg_id, name, username, phone, bio, photo_url, 'scan', '{fields}' "
                f"FROM {SCHEMA}.check_lists WHERE id={int(item_id)}")
        conn.commit()
        return {'id': item_id, 'status': 'ok', 'changes': len(changes)}
    finally:
        cur.close()
        conn.close()


def handle_scan(event: dict) -> dict:
    headers = event.get('headers') or {}
    if not verify_admin(headers.get('X-Admin-Token') or headers.get('x-admin-token') or ''):
        return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Unauthorized'})}
    body = json.loads(event.get('body') or '{}')
    ids = [int(x) for x in (body.get('ids') or [])][:4]
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for r in pool.map(scan_item, ids):
            results.append(r)
    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'results': results})}


def send_reminders() -> int:
    """За 3 дня до конца подписки — одно напоминание с кнопкой продления."""
    sent = 0
    for uid, until, is_trial in payments.due_reminders():
        kind = 'Тестовый период' if is_trial else 'Подписка'
        res = tg_api('sendMessage', {'chat_id': uid, 'parse_mode': 'HTML', 'reply_markup': payments.PLANS_MARKUP,
                                     'text': f"⏳ <b>{kind} скоро закончится</b>\n\n"
                                             f"📅 Действует до: <b>{until.strftime('%d.%m.%Y %H:%M')}</b>\n\n"
                                             'Продлите заранее, чтобы не потерять доступ к списку групп и поиску. '
                                             'Новый срок добавится к оставшимся дням.'}, timeout=3)
        if res.get('ok') or 'blocked' in str(res.get('description', '')) or 'not found' in str(res.get('description', '')):
            payments.mark_reminded(uid)
            sent += 1 if res.get('ok') else 0
    return sent


def handle_daily_scan(event: dict, context) -> dict:
    """Ежедневный обход всех карточек: сначала давно не сканированные, пока хватает времени."""
    headers = event.get('headers') or {}
    qs = event.get('queryStringParameters') or {}
    secret = os.environ.get('CRON_SECRET', '')
    given = headers.get('X-Cron-Secret') or headers.get('x-cron-secret') or qs.get('secret') or ''
    if not secret or given != secret:
        return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Unauthorized'})}
    started = time.time()
    reminded = send_reminders()
    print(f'[KB-BOT] reminders sent: {reminded}')
    try:
        budget = context.get_remaining_time_in_millis() / 1000 - 3 - (time.time() - started)
    except Exception:
        budget = 2.5
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        cur.execute(f"SELECT id FROM {SCHEMA}.check_lists WHERE tg_id IS NOT NULL "
                    f"AND (last_scan_at IS NULL OR last_scan_at < now() - interval '20 hours') "
                    f"ORDER BY last_scan_at NULLS FIRST, id LIMIT 300")
        ids = [r[0] for r in cur.fetchall()]
    finally:
        cur.close()
        conn.close()
    done, changed, errors = 0, 0, 0
    for i in range(0, len(ids), 4):
        if time.time() - started > budget:
            break
        chunk = ids[i:i + 4]
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            for r in pool.map(scan_item, chunk):
                done += 1
                changed += r.get('changes', 0) or 0
                errors += 1 if r.get('status') == 'error' else 0
    left = len(ids) - done
    print(f'[KB-BOT] daily scan: done={done} changes={changed} errors={errors} left={left}')
    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(
        {'ok': True, 'scanned': done, 'changes': changed, 'errors': errors, 'left': left, 'reminded': reminded})}


def private_only_commands() -> dict:
    """Команды бота видны только в личке: в группах меню «/» пустое."""
    res = {}
    for scope in ('default', 'all_group_chats', 'all_chat_administrators'):
        res[scope] = tg_api('deleteMyCommands', {'scope': {'type': scope}}, timeout=2.2).get('ok')
    res['private'] = tg_api('setMyCommands', {'commands': [{'command': 'start', 'description': 'Главное меню'}, {'command': 'complain', 'description': 'Отправить жалобу'}, {'command': 'role', 'description': 'Сменить роль'}], 'scope': {'type': 'all_private_chats'}}, timeout=2.2).get('ok')
    return res


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}
    try:
        DEADLINE['t'] = time.time() + context.get_remaining_time_in_millis() / 1000
    except Exception:
        DEADLINE['t'] = time.time() + 4.5

    if (event.get('queryStringParameters') or {}).get('action') == 'daily_scan':
        return handle_daily_scan(event, context)

    if event.get('httpMethod') == 'GET':
        qs = event.get('queryStringParameters') or {}
        action = qs.get('action', '')
        if action == 'bot_info':
            me_res = tg_api('getMe', {}, timeout=2.2)
            me = me_res.get('result', {})
            wh = tg_api('getWebhookInfo', {}, timeout=2.2).get('result', {}) if me else {}
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({
                'ok': bool(me), 'username': me.get('username', ''), 'webhook': wh.get('url', ''),
                'error': me_res.get('description', '') if not me else ''})}
        if action == 'complaint_to_group':
            tg_api('getMe', {}, timeout=2.5)
            res = complaints.send_to_decision(tg_api, int(qs.get('id') or 0))
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(res, ensure_ascii=False)}
        if action == 'complaint_refresh_buttons':
            cid = int(qs.get('id') or 0)
            conn = psycopg2.connect(os.environ['DATABASE_URL'])
            cur = conn.cursor()
            cur.execute(f"SELECT k.group_chat, k.group_msg_id, k.status, c.list_type, c.role FROM {SCHEMA}.kb_complaints k "
                        f"LEFT JOIN {SCHEMA}.check_lists c ON c.id = k.item_id WHERE k.id={cid}")
            r = cur.fetchone()
            conn.close()
            res = {}
            if r and r[0] and r[1] and r[2] == 'new':
                res = tg_api('editMessageReplyMarkup', {'chat_id': r[0], 'message_id': r[1],
                                                        'reply_markup': complaints.admin_markup(cid, r[3] or '', r[4] or '')
                                                        if r[0] == complaints.COPY_CHAT else complaints.decision_markup(cid, r[3] or '')}, timeout=3)
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': res.get('ok'), 'error': res.get('description', '')}, ensure_ascii=False)}
        if action == 'complaint_decided':
            cid = int(qs.get('id') or 0)
            st = qs.get('status', '')
            if st == 'accepted' and qs.get('black') == '1':
                complaints.publish_verdict(tg_api, cid, 'администратор (админка)')
            elif st == 'rejected':
                complaints.delete_group_messages(tg_api, cid)
            else:
                complaints.mark_group_message(tg_api, cid, '✅ Принята — из админки')
            complaints.notify_reporter(tg_api, cid)
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}
        if action == 'test_complaint_topic':
            res = tg_api('sendMessage', {'chat_id': complaints.COPY_CHAT, 'message_thread_id': complaints.COMPLAINTS_THREAD_ID,
                                         'text': '✅ Сюда будут приходить новые жалобы из бота «База знаний».'}, timeout=4)
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': res.get('ok'), 'error': res.get('description', '')}, ensure_ascii=False)}
        if action == 'test_complaint_chat':
            out = {}
            for chat in complaints.CHAT_CANDIDATES + [qs.get('chat', '')]:
                if not chat:
                    continue
                res = tg_api('getChat', {'chat_id': chat}, timeout=3)
                r = res.get('result') or {}
                out[chat] = {'title': r.get('title') or res.get('description', '')[:80], 'is_forum': r.get('is_forum'), 'id': r.get('id')}
                if r.get('id'):
                    me = tg_api('getMe', {}, timeout=3).get('result') or {}
                    mem = tg_api('getChatMember', {'chat_id': r['id'], 'user_id': me.get('id')}, timeout=3).get('result') or {}
                    out[chat]['bot_status'] = mem.get('status')
                    out[chat]['can_post'] = mem.get('can_post_messages', mem.get('can_send_messages'))
                    out[chat]['can_delete'] = mem.get('can_delete_messages')
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(out, ensure_ascii=False)}
        if action == 'private_commands':
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(private_only_commands())}
        if action == 'set_webhook':
            url = qs.get('url', '')
            if not url:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'url required'})}
            res = tg_api('setWebhook', {'url': url, 'allowed_updates': ['message', 'callback_query', 'chat_member']}, timeout=2.2)
            if res.get('ok'):
                private_only_commands()
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(res)}
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'status': 'bot active'})}

    qs = event.get('queryStringParameters') or {}
    if qs.get('action') == 'yookassa':
        return handle_yookassa(event)
    if qs.get('action') == 'scan':
        return handle_scan(event)

    body = json.loads(event.get('body') or '{}')
    callback = body.get('callback_query') or {}
    if str(callback.get('data') or '').startswith('crole:'):
        complaints.handle_role_button(tg_api, callback)
        return {'statusCode': 200, 'headers': CORS, 'body': 'ok'}
    if str(callback.get('data') or '').startswith('csend:'):
        complaints.handle_send_button(tg_api, callback)
        return {'statusCode': 200, 'headers': CORS, 'body': 'ok'}
    if str(callback.get('data') or '').startswith('creject:'):
        complaints.handle_reject_button(tg_api, callback)
        return {'statusCode': 200, 'headers': CORS, 'body': 'ok'}
    if str(callback.get('data') or '').startswith('cblack:'):
        complaints.handle_black_button(tg_api, callback)
        return {'statusCode': 200, 'headers': CORS, 'body': 'ok'}
    if callback.get('data') == 'noop':
        tg_api('answerCallbackQuery', {'callback_query_id': callback.get('id'), 'text': 'Уже обработано'}, timeout=2.2)
        return {'statusCode': 200, 'headers': CORS, 'body': 'ok'}
    if str(callback.get('data') or '').startswith('complain:'):
        complaints.start(tg_api, callback)
        return {'statusCode': 200, 'headers': CORS, 'body': 'ok'}
    if str(callback.get('data') or '').startswith('myrole:'):
        handle_my_role(callback)
        return {'statusCode': 200, 'headers': CORS, 'body': 'ok'}
    if str(callback.get('data') or '').startswith('buy:'):
        handle_buy(callback)
        return {'statusCode': 200, 'headers': CORS, 'body': 'ok'}
    if str(callback.get('data') or '').startswith('paid:'):
        handle_paid(callback)
        return {'statusCode': 200, 'headers': CORS, 'body': 'ok'}
    if callback.get('data') == 'renew_sub':
        handle_renew(callback)
        return {'statusCode': 200, 'headers': CORS, 'body': 'ok'}

    member_upd = body.get('chat_member') or {}
    if member_upd and str((member_upd.get('chat') or {}).get('id')) in complaints.CHAT_CANDIDATES:
        return {'statusCode': 200, 'headers': CORS, 'body': 'ok'}
    if member_upd:
        save_tg_user((member_upd.get('new_chat_member') or {}).get('user') or {}, 'group')
        return {'statusCode': 200, 'headers': CORS, 'body': 'ok'}

    message = body.get('message') or {}
    chat = message.get('chat') or {}
    if str(chat.get('id')) in complaints.CHAT_CANDIDATES:
        # Служебная группа жалоб — только отправляем туда, участников не собираем.
        return {'statusCode': 200, 'headers': CORS, 'body': 'ok'}
    save_tg_user(message.get('from') or {}, 'group' if chat.get('type') in ('group', 'supergroup') else 'bot')
    fwd = message.get('forward_from') or {}
    if fwd:
        save_tg_user(fwd, 'forward')
    for m in message.get('new_chat_members') or []:
        save_tg_user(m, 'group')
    chat_id = chat.get('id')
    text = (message.get('text') or '').strip()

    if not chat_id or chat.get('type') != 'private':
        return {'statusCode': 200, 'headers': CORS, 'body': 'ok'}

    if complaints.handle_message(tg_api, tg_download, store_photo, message, MAIN_KEYBOARD,
                                 lambda cid: complaints.notify_admin(tg_api, cid)):
        return {'statusCode': 200, 'headers': CORS, 'body': 'ok'}

    reply_text = ((message.get('reply_to_message') or {}).get('text') or '')
    if text == BUTTON_COMPLAIN or text.lower() in ('/complain', 'жалоба', 'пожаловаться'):
        ask_complaint_target(chat_id)
        return {'statusCode': 200, 'headers': CORS, 'body': 'ok'}
    if COMPLAIN_PROMPT in reply_text and text:
        run_complaint_target(chat_id, message.get('from') or {}, text)
        return {'statusCode': 200, 'headers': CORS, 'body': 'ok'}
    reply_kind = 'any' if CHECKS_ANY['prompt'] in reply_text else next((k for k, c in CHECKS.items() if c['prompt'] in reply_text), '')

    uid = (message.get('from') or {}).get('id') or chat_id
    is_check_btn = text in (BUTTON_CHECK, BUTTON_CHECK_DRIVER, BUTTON_CHECK_DISP) or text.lower() in ('проверить', '/check')
    if text == BUTTON_GROUPS or text.lower() in ('список групп', '/groups'):
        if sub_active(uid):
            send_groups(chat_id)
        else:
            send_paywall(chat_id, 'Список групп')
    elif (is_check_btn or reply_kind) and not can_check(uid):
        send_paywall(chat_id, 'Поиск и проверка')
    elif text == BUTTON_CHECK or text.lower() in ('проверить', '/check'):
        ask_check(chat_id, 'any')
    elif text == BUTTON_CHECK_DRIVER:
        ask_check(chat_id, 'driver')
    elif text == BUTTON_CHECK_DISP:
        ask_check(chat_id, 'disp')
    elif reply_kind:
        run_check(chat_id, reply_kind, text)
    elif text == BUTTON_SUB or text.lower() in ('моя подписка', '/sub'):
        send_subscription(chat_id, (message.get('from') or {}).get('id') or chat_id)
    elif text.split('@')[0] == '/role':
        tg_api('deleteMessage', {'chat_id': chat_id, 'message_id': message.get('message_id')}, timeout=2.2)
        ask_role(chat_id, (message.get('from') or {}).get('id') or chat_id)
    elif text.split(' ')[0].split('@')[0] == '/start':
        send_welcome(chat_id, message.get('from') or {}, message.get('message_id'))
    elif text.startswith('/'):
        tg_api('sendMessage', {'chat_id': chat_id, 'text': 'Выберите пункт меню 👇',
                               'reply_markup': MAIN_KEYBOARD})
    elif looks_like_person(text) and not can_check(uid):
        send_paywall(chat_id, 'Поиск и проверка')
    else:
        run_search(chat_id, text)

    return {'statusCode': 200, 'headers': CORS, 'body': 'ok'}
