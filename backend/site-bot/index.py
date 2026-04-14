"""Telegram-бот @ug_sait_bot — открывает сайт ug-transfer.online как Web App."""
import os
import json
import urllib.request

SITE_URL = 'https://ug-transfer.online'


def get_bot_token():
    return os.environ.get('TELEGRAM_BOT_TOKEN_2', '')


def tg_api(method, payload):
    url = f"https://api.telegram.org/bot{get_bot_token()}/{method}"
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except Exception:
        return {}


def handler(event: dict, context) -> dict:
    """Обработчик бота @ug_sait_bot — Web App кнопка для открытия сайта."""
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    if event.get('httpMethod') == 'GET':
        qs = event.get('queryStringParameters') or {}
        if qs.get('action') == 'bot_info':
            result = tg_api('getMe', {})
            bot = result.get('result', {})
            wh = tg_api('getWebhookInfo', {})
            wh_url = wh.get('result', {}).get('url', '')
            return {
                'statusCode': 200,
                'headers': cors,
                'body': json.dumps({'ok': True, 'username': bot.get('username', ''), 'webhook_active': bool(wh_url)}),
            }
        if qs.get('action') == 'set_webhook':
            func_url = qs.get('url', '')
            if not func_url:
                return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'error': 'url required'})}
            result = tg_api('setWebhook', {'url': func_url})
            tg_api('setChatMenuButton', {
                'menu_button': {
                    'type': 'web_app',
                    'text': '🚐 Открыть сайт',
                    'web_app': {'url': SITE_URL},
                }
            })
            tg_api('setMyCommands', {
                'commands': [
                    {'command': 'start', 'description': 'Запустить бота'},
                ]
            })
            return {'statusCode': 200, 'headers': cors, 'body': json.dumps(result)}
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'ok': True, 'status': 'bot active'})}

    body = json.loads(event.get('body') or '{}')
    message = body.get('message')
    if not message:
        return {'statusCode': 200, 'headers': cors, 'body': 'ok'}

    chat_id = message['chat']['id']
    text = message.get('text', '')
    first_name = message.get('from', {}).get('first_name', '')

    if text.startswith('/start'):
        tg_api('sendMessage', {
            'chat_id': chat_id,
            'text': f'👋 <b>Привет, {first_name}!</b>\n\n🚐 Я бот ЮГ ТРАНСФЕР.\n\nНажми кнопку ниже, чтобы открыть наш сайт 👇',
            'parse_mode': 'HTML',
            'reply_markup': {
                'inline_keyboard': [[{
                    'text': '🚀 Открыть сайт',
                    'web_app': {'url': SITE_URL},
                }]]
            },
        })

    return {'statusCode': 200, 'headers': cors, 'body': 'ok'}