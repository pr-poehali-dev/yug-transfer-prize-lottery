"""Telegram-бот @ug_sait_bot — открывает сайт ug-transfer.online как Web App."""
import os
import json
import urllib.request
import psycopg2

SITE_URL = 'https://ug-transfer.online'
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')


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
                    'text': '🚕 Заказать такси',
                    'web_app': {'url': SITE_URL},
                }
            })
            tg_api('deleteMyCommands', {})
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
        username = message.get('from', {}).get('username', '')
        try:
            conn = psycopg2.connect(os.environ['DATABASE_URL'])
            cur = conn.cursor()
            cur.execute(f"INSERT INTO {SCHEMA}.sait_bot_users (chat_id, first_name, username) VALUES ({chat_id}, '{first_name}', '{username}') ON CONFLICT (chat_id) DO UPDATE SET first_name = '{first_name}', username = '{username}'")
            conn.commit()
            cur.close()
            conn.close()
        except Exception:
            pass
        tg_api('deleteMessage', {
            'chat_id': chat_id,
            'message_id': message['message_id'],
        })
        tg_api('setChatMenuButton', {
            'chat_id': chat_id,
            'menu_button': {
                'type': 'web_app',
                'text': 'Заказать такси',
                'web_app': {'url': SITE_URL},
            }
        })
        tg_api('sendMessage', {
            'chat_id': chat_id,
            'text': '🚕',
            'reply_markup': {
                'keyboard': [
                    [{'text': '🚕 Заказать такси', 'web_app': {'url': SITE_URL}}],
                ],
                'resize_keyboard': True,
                'is_persistent': True,
                'input_field_placeholder': ' ',
            },
        })

    return {'statusCode': 200, 'headers': cors, 'body': 'ok'}