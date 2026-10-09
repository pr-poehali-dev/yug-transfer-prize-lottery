"""Telegram-бот базы знаний: по /start показывает кнопку «Список групп» и присылает список из базы знаний."""
import os
import json
import ssl
import http.client
import psycopg2

SCHEMA = 't_p67171637_yug_transfer_prize_l'
BUTTON_GROUPS = '📋 Список групп'
TG_HOSTS = ['149.154.167.220', '149.154.167.99', '91.108.56.130', 'api.telegram.org']
CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}
MAIN_KEYBOARD = {'keyboard': [[{'text': BUTTON_GROUPS}]], 'resize_keyboard': True, 'is_persistent': True}


def tg_api(method: str, payload: dict, timeout: int = 6) -> dict:
    """Запрос к Telegram: из облака часть адресов недоступна, перебираем рабочие."""
    token = os.environ.get('KB_BOT_TOKEN', '')
    data = json.dumps(payload).encode()
    for host in TG_HOSTS:
        ctx = ssl.create_default_context()
        if host != 'api.telegram.org':
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
        conn = http.client.HTTPSConnection(host, 443, timeout=timeout, context=ctx)
        try:
            conn.request('POST', f'/bot{token}/{method}', body=data,
                         headers={'Content-Type': 'application/json', 'Host': 'api.telegram.org'})
            return json.loads(conn.getresponse().read())
        except Exception as e:
            print(f'[KB-BOT] {method} via {host} failed: {type(e).__name__}')
        finally:
            conn.close()
    return {}


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
            me = tg_api('getMe', {}).get('result', {})
            wh = tg_api('getWebhookInfo', {}).get('result', {})
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({
                'ok': True, 'username': me.get('username', ''), 'webhook': wh.get('url', '')})}
        if action == 'set_webhook':
            url = qs.get('url', '')
            if not url:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'url required'})}
            res = tg_api('setWebhook', {'url': url, 'allowed_updates': ['message']})
            tg_api('setMyCommands', {'commands': [{'command': 'start', 'description': 'Главное меню'}]})
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(res)}
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'status': 'bot active'})}

    body = json.loads(event.get('body') or '{}')
    message = body.get('message') or {}
    chat = message.get('chat') or {}
    chat_id = chat.get('id')
    text = (message.get('text') or '').strip()

    if not chat_id or chat.get('type') != 'private':
        return {'statusCode': 200, 'headers': CORS, 'body': 'ok'}

    if text == BUTTON_GROUPS or text.lower() in ('список групп', '/groups'):
        send_groups(chat_id)
    else:
        tg_api('sendMessage', {'chat_id': chat_id, 'text': 'Выберите пункт меню 👇',
                               'reply_markup': MAIN_KEYBOARD})

    return {'statusCode': 200, 'headers': CORS, 'body': 'ok'}
