"""Telegram-бот базы знаний: по /start показывает кнопку «Список групп» и присылает список из базы знаний."""
import os
import json
import ssl
import http.client
import concurrent.futures
import psycopg2

SCHEMA = 't_p67171637_yug_transfer_prize_l'
BUTTON_GROUPS = '📋 Список групп'
BUTTON_SUB = '💳 Моя подписка'
BUTTON_CHECK_DRIVER = '🚗 Проверить водителя'
BUTTON_CHECK_DISP = '🎧 Проверить диспетчера'
CHECKS = {
    'driver': {'button': BUTTON_CHECK_DRIVER, 'prompt': 'Проверка водителя', 'category': 'водител', 'who': 'Водитель'},
    'disp': {'button': BUTTON_CHECK_DISP, 'prompt': 'Проверка диспетчера', 'category': 'диспетчер', 'who': 'Диспетчер'},
}
TG_HOSTS = ['149.154.167.220', '149.154.167.99', '91.108.56.130', 'api.telegram.org']
CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}
LAST_OK = {'host': ''}
RENEW_MARKUP = {'inline_keyboard': [[{'text': '🔄 Продлить подписку', 'callback_data': 'renew_sub'}]]}
MAIN_KEYBOARD = {'keyboard': [[{'text': BUTTON_GROUPS}], [{'text': BUTTON_SUB}], [{'text': BUTTON_CHECK_DRIVER}, {'text': BUTTON_CHECK_DISP}]], 'resize_keyboard': True, 'is_persistent': True}


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


def send_subscription(chat_id, user_id) -> None:
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        cur.execute(
            f"SELECT active_until, active_until > NOW() FROM {SCHEMA}.driver_subs "
            f"WHERE tg_user_id = {int(user_id)}")
        row = cur.fetchone()
    finally:
        cur.close()
        conn.close()

    if not row or not row[0]:
        text = '💳 <b>Моя подписка</b>\n\nУ вас пока нет подписки.'
    elif row[1]:
        until = row[0].strftime('%d.%m.%Y %H:%M')
        text = f'💳 <b>Моя подписка</b>\n\n✅ Активна\n📅 Действует до: <b>{until}</b>'
    else:
        until = row[0].strftime('%d.%m.%Y')
        text = f'💳 <b>Моя подписка</b>\n\n❌ Закончилась {until}'
    tg_api('sendMessage', {'chat_id': chat_id, 'text': text, 'parse_mode': 'HTML',
                           'reply_markup': RENEW_MARKUP})


def create_payment_url(user_id) -> str:
    """Заглушка под ЮKassa: здесь будет создание платежа и возврат ссылки на оплату."""
    return ''


def handle_renew(callback: dict) -> None:
    user_id = (callback.get('from') or {}).get('id')
    chat_id = ((callback.get('message') or {}).get('chat') or {}).get('id') or user_id
    url = create_payment_url(user_id)
    if url:
        tg_api('answerCallbackQuery', {'callback_query_id': callback.get('id')}, timeout=2.2)
        tg_api('sendMessage', {'chat_id': chat_id, 'text': '💳 Перейдите к оплате подписки:',
                               'reply_markup': {'inline_keyboard': [[{'text': 'Оплатить', 'url': url}]]}})
        return
    tg_api('answerCallbackQuery', {'callback_query_id': callback.get('id'),
                                   'text': 'Онлайн-оплата скоро появится', 'show_alert': False}, timeout=2.2)
    tg_api('sendMessage', {'chat_id': chat_id,
                           'text': '🔧 Онлайн-оплата подписки скоро будет доступна.\n'
                                   'Чтобы продлить подписку сейчас, напишите администратору.',
                           'reply_markup': MAIN_KEYBOARD})


def ask_check(chat_id, kind: str) -> None:
    c = CHECKS[kind]
    tg_api('sendMessage', {
        'chat_id': chat_id,
        'text': f"🔎 {c['prompt']}\n\nОтправьте ответом на это сообщение @username или номер телефона.",
        'reply_markup': {'force_reply': True, 'input_field_placeholder': '@username или телефон'},
    })


def normalize_query(q: str) -> str:
    q = q.strip()
    digits = ''.join(ch for ch in q if ch.isdigit())
    if len(digits) >= 10 and len(digits) >= len(q.replace(' ', '')) - 4:
        return digits[-10:]
    return q.lstrip('@').lower()


def run_check(chat_id, kind: str, query: str) -> None:
    c = CHECKS[kind]
    q = normalize_query(query)
    if len(q) < 3:
        tg_api('sendMessage', {'chat_id': chat_id, 'text': 'Слишком короткий запрос. Попробуйте ещё раз.',
                               'reply_markup': MAIN_KEYBOARD})
        return
    qe = q.replace("'", "''").replace('%', '').replace('_', '\\_')
    digits_expr = "regexp_replace(title || ' ' || content, '[^0-9]', '', 'g')"
    cond = (f"{digits_expr} LIKE '%{qe}%'" if q.isdigit()
            else f"(title || ' ' || content) ILIKE '%{qe}%'")
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        cur.execute(
            f"SELECT title, category, content FROM {SCHEMA}.knowledge_base "
            f"WHERE category ILIKE '%{c['category']}%' AND {cond} ORDER BY id LIMIT 5")
        rows = cur.fetchall()
    finally:
        cur.close()
        conn.close()

    shown = esc_html(query.strip())
    if not rows:
        text = (f"✅ {c['who']} <b>{shown}</b> не найден в нашей базе.\n\n"
                f"Жалоб и отметок по нему нет.")
    else:
        parts = [f"⚠️ {c['who']} <b>{shown}</b> найден в базе:"]
        for title, category, content in rows:
            parts.append(f"\n<b>{esc_html(title)}</b>\n{esc_html(content)[:1500]}")
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


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

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
        if action == 'set_webhook':
            url = qs.get('url', '')
            if not url:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'url required'})}
            res = tg_api('setWebhook', {'url': url, 'allowed_updates': ['message', 'callback_query']}, timeout=2.2)
            if res.get('ok'):
                tg_api('setMyCommands', {'commands': [{'command': 'start', 'description': 'Главное меню'}]}, timeout=2.2)
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(res)}
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'status': 'bot active'})}

    body = json.loads(event.get('body') or '{}')
    callback = body.get('callback_query') or {}
    if callback.get('data') == 'renew_sub':
        handle_renew(callback)
        return {'statusCode': 200, 'headers': CORS, 'body': 'ok'}

    message = body.get('message') or {}
    chat = message.get('chat') or {}
    chat_id = chat.get('id')
    text = (message.get('text') or '').strip()

    if not chat_id or chat.get('type') != 'private':
        return {'statusCode': 200, 'headers': CORS, 'body': 'ok'}

    reply_text = ((message.get('reply_to_message') or {}).get('text') or '')
    reply_kind = next((k for k, c in CHECKS.items() if c['prompt'] in reply_text), '')

    if text == BUTTON_GROUPS or text.lower() in ('список групп', '/groups'):
        send_groups(chat_id)
    elif text == BUTTON_CHECK_DRIVER:
        ask_check(chat_id, 'driver')
    elif text == BUTTON_CHECK_DISP:
        ask_check(chat_id, 'disp')
    elif reply_kind:
        run_check(chat_id, reply_kind, text)
    elif text == BUTTON_SUB or text.lower() in ('моя подписка', '/sub'):
        send_subscription(chat_id, (message.get('from') or {}).get('id') or chat_id)
    else:
        tg_api('sendMessage', {'chat_id': chat_id, 'text': 'Выберите пункт меню 👇',
                               'reply_markup': MAIN_KEYBOARD})

    return {'statusCode': 200, 'headers': CORS, 'body': 'ok'}
