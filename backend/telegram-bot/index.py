"""Telegram-бот ЮГ ТРАНСФЕР. Открывает сайт как Web App, привязка аккаунта через deep link."""
import os
import json
import urllib.request
import psycopg2

SITE_URL = 'https://ug-transfer.online'
def get_bot_token():
    return os.environ.get('TELEGRAM_BOT_TOKEN', '')


def get_schema():
    return os.environ.get('MAIN_DB_SCHEMA', 'public')


def tg_api(method, payload):
    url = f"https://api.telegram.org/bot{get_bot_token()}/{method}"
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except Exception:
        return {}


def get_active_raffles():
    schema = get_schema()
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    cur.execute(
        f"SELECT title, prize, min_amount, end_date FROM {schema}.raffles WHERE status = 'active' ORDER BY end_date ASC LIMIT 5"
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows


def send_welcome(chat_id, name):
    raffles = get_active_raffles()
    if raffles:
        lines = [f'🎰 <b>{r[0]}</b> — приз: {r[1]}, участие от {r[2]} ₽' for r in raffles]
        raffles_text = '\n'.join(lines)
        text = (
            f'🎉 <b>{name}, добро пожаловать в ЮГ ТРАНСФЕР!</b>\n\n'
            f'🔥 Сейчас активны розыгрыши:\n\n{raffles_text}\n\n'
            f'Удачи! 🍀'
        )
    else:
        text = (
            f'🎉 <b>{name}, добро пожаловать в ЮГ ТРАНСФЕР!</b>\n\n'
            f'Сейчас активных розыгрышей нет, но скоро появятся новые!\n'
            f'Мы сообщим тебе первому 🔔'
        )
    tg_api('sendMessage', {
        'chat_id': chat_id,
        'text': text,
        'parse_mode': 'HTML',
        'disable_web_page_preview': True,
        'reply_markup': {
            'inline_keyboard': [[{
                'text': '🚀 Открыть сайт',
                'web_app': {'url': SITE_URL},
            }]]
        },
    })


def handler(event: dict, context) -> dict:
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
            return {
                'statusCode': 200,
                'headers': cors,
                'body': json.dumps({'ok': True, 'username': bot.get('username', '')}),
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
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'ok': True, 'status': 'bot webhook active'})}

    body = json.loads(event.get('body') or '{}')

    message = body.get('message')
    if not message:
        return {'statusCode': 200, 'headers': cors, 'body': 'ok'}

    chat_id = message['chat']['id']
    text = message.get('text', '')
    tg_user = message.get('from', {})
    telegram_id = tg_user.get('id', 0)
    first_name = tg_user.get('first_name', '')
    username = tg_user.get('username', '')

    if text.startswith('/start'):
        parts = text.split()
        if len(parts) > 1 and parts[1].startswith('link_'):
            user_id_str = parts[1].replace('link_', '')
            try:
                user_id = int(user_id_str)
            except ValueError:
                tg_api('sendMessage', {'chat_id': chat_id, 'text': '❌ Неверная ссылка привязки.'})
                return {'statusCode': 200, 'headers': cors, 'body': 'ok'}

            schema = get_schema()
            conn = psycopg2.connect(os.environ['DATABASE_URL'])
            cur = conn.cursor()

            cur.execute(f"SELECT id FROM {schema}.users WHERE telegram_id = %s AND telegram_id != 0 AND id != %s", (telegram_id, user_id))
            if cur.fetchone():
                tg_api('sendMessage', {'chat_id': chat_id, 'text': '⚠️ Этот Telegram уже привязан к другому аккаунту.'})
                cur.close()
                conn.close()
                return {'statusCode': 200, 'headers': cors, 'body': 'ok'}

            cur.execute(
                f"UPDATE {schema}.users SET telegram_id = %s, username = %s, updated_at = NOW() WHERE id = %s RETURNING first_name",
                (telegram_id, username, user_id)
            )
            row = cur.fetchone()
            conn.commit()
            cur.close()
            conn.close()

            if row:
                name = row[0] or first_name
                tg_api('sendMessage', {
                    'chat_id': chat_id,
                    'text': f'✅ Telegram привязан к аккаунту «{name}»!\n\nТеперь ты будешь получать уведомления о розыгрышах и выигрышах.',
                    'parse_mode': 'HTML',
                })
                send_welcome(chat_id, name)
            else:
                tg_api('sendMessage', {'chat_id': chat_id, 'text': '❌ Аккаунт не найден. Проверь ссылку.'})
        else:
            tg_api('sendMessage', {
                'chat_id': chat_id,
                'text': f'👋 <b>Привет, {first_name}!</b>\n\nЯ бот ЮГ ТРАНСФЕР 🚐\n\nНажми кнопку ниже, чтобы открыть наш сайт 👇',
                'parse_mode': 'HTML',
                'reply_markup': {
                    'inline_keyboard': [[{
                        'text': '🚀 Открыть сайт',
                        'web_app': {'url': SITE_URL},
                    }]]
                },
            })
    return {'statusCode': 200, 'headers': cors, 'body': 'ok'}