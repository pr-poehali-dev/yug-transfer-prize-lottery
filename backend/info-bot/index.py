"""Telegram-бот @ug_info_bot — приветствие с кнопкой «поиск заказов»."""
import os
import json
import ssl
import http.client

SEARCH_URL = 'https://t.me/OneTMM_Bot?start=ref_6072837543'
SEARCH_BUTTON_TEXT = '🔍 поиск заказов'
START_TEXT = (
    '👋 <b>Информация</b>\n\n'
    'Чтобы упростить процесс поиска заказов, жми кнопку «Поиск заказов». '
    'Теперь вам не нужно самостоятельно отслеживать группы — бот сделает это за вас!'
)
SEARCH_TEXT = 'Переход к поиску заказов 👇'

TG_HOSTS = ['149.154.167.220', '149.154.167.99', '91.108.56.130', 'api.telegram.org']
LAST_OK_HOST = ''


def get_bot_token():
    return os.environ.get('UG_INFO_BOT_TOKEN_NEW', '') or os.environ.get('TELEGRAM_BOT_TOKEN', '')


def tg_api(method, payload, timeout=8, hosts=None):
    """Запрос к Telegram: из облака часть адресов недоступна, перебираем рабочие."""
    data = json.dumps(payload).encode()
    for host in (hosts or TG_HOSTS):
        ctx = ssl.create_default_context()
        if host != 'api.telegram.org':
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
        conn = http.client.HTTPSConnection(host, 443, timeout=timeout, context=ctx)
        try:
            conn.request('POST', f'/bot{get_bot_token()}/{method}', body=data,
                         headers={'Content-Type': 'application/json', 'Host': 'api.telegram.org'})
            result = json.loads(conn.getresponse().read())
            global LAST_OK_HOST
            LAST_OK_HOST = host
            return result
        except Exception as e:
            print(f'[INFO-BOT] {method} via {host} failed: {type(e).__name__}')
        finally:
            conn.close()
    return {}


SEARCH_MARKUP = {'inline_keyboard': [[{'text': SEARCH_BUTTON_TEXT, 'url': SEARCH_URL}]]}

# Постоянная кнопка под строкой ввода — видна всегда.
BOTTOM_KEYBOARD = {
    'keyboard': [[{'text': SEARCH_BUTTON_TEXT}]],
    'resize_keyboard': True,
    'is_persistent': True,
    'input_field_placeholder': '200+ групп',
}


def handler(event: dict, context) -> dict:
    """Обработчик бота @ug_info_bot: по /start шлёт кнопку «поиск заказов»."""
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    if event.get('httpMethod') == 'GET':
        qs = event.get('queryStringParameters') or {}
        action = qs.get('action', '')
        if action == 'bot_info':
            me = tg_api('getMe', {}).get('result', {})
            wh = tg_api('getWebhookInfo', {}).get('result', {})
            return {'statusCode': 200, 'headers': cors, 'body': json.dumps({
                'ok': True, 'username': me.get('username', ''),
                'webhook': wh.get('url', ''),
            })}
        if action == 'set_webhook':
            func_url = qs.get('url', '')
            if not func_url:
                return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'error': 'url required'})}
            res = tg_api('setWebhook', {'url': func_url, 'allowed_updates': ['message']})
            tg_api('setChatMenuButton', {'menu_button': {'type': 'commands'}})
            tg_api('setMyCommands', {'commands': [{'command': 'start', 'description': 'Поиск заказов'}]})
            return {'statusCode': 200, 'headers': cors, 'body': json.dumps(res)}
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'ok': True, 'status': 'bot active'})}

    body = json.loads(event.get('body') or '{}')
    message = body.get('message') or {}
    chat_id = (message.get('chat') or {}).get('id')
    text = message.get('text') or ''

    if chat_id and (message.get('chat') or {}).get('type') == 'private':
        if text.startswith('/start'):
            payload = {
                'chat_id': chat_id,
                'text': START_TEXT,
                'parse_mode': 'HTML',
                'reply_markup': BOTTOM_KEYBOARD,
            }
        else:
            payload = {
                'chat_id': chat_id,
                'text': SEARCH_TEXT,
                'parse_mode': 'HTML',
                'reply_markup': SEARCH_MARKUP,
            }
        res = tg_api('sendMessage', payload, hosts=[LAST_OK_HOST] if LAST_OK_HOST else None)
        print(f"[INFO-BOT] chat={chat_id} text={text[:20]} ok={res.get('ok')}")

    return {'statusCode': 200, 'headers': cors, 'body': 'ok'}