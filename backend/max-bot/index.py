"""Бот MAX: при первом обращении клиента шлёт блок заказа с кнопкой и закрепляет его."""
import os
import json
import urllib.request
import urllib.error
import psycopg2

SITE_URL = 'https://ug-transfer.online'
MAX_API = 'https://platform-api.max.ru'
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')

GREET_TEXT = (
    '🚕 ЮГ-Трансфер — заказ такси\n\n'
    'Нажмите кнопку ниже, чтобы рассчитать стоимость и оформить поездку.\n'
    'Работаем по всей России · Трансферы · Межгород\n\n'
    '📞 +7 (995) 614-14-14'
)


def get_token() -> str:
    return (os.environ.get('MAX_BOT_TOKEN_NEW', '') or os.environ.get('MAX_BOT_TOKEN', '')).strip()


def max_api(path: str, payload=None, method: str = 'POST') -> dict:
    """Запрос к API MAX. Токен передаём заголовком Authorization."""
    token = get_token()
    if not token:
        return {'ok': False, 'error': 'MAX_BOT_TOKEN не задан'}
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(f'{MAX_API}{path}', data=data, method=method)
    req.add_header('Authorization', token)
    if data:
        req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            body = r.read().decode('utf-8')
            return json.loads(body) if body else {'ok': True}
    except urllib.error.HTTPError as e:
        try:
            detail = e.read().decode('utf-8')[:300]
        except Exception:
            detail = ''
        return {'ok': False, 'error': f'HTTP {e.code}: {detail}'}
    except Exception as e:
        return {'ok': False, 'error': f'{type(e).__name__}: {str(e)[:200]}'}


def already_greeted(chat_id) -> bool:
    """Проверяем, отправляли ли уже блок заказа в этот диалог."""
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    try:
        cur = conn.cursor()
        cur.execute(f"SELECT 1 FROM {SCHEMA}.max_greeted WHERE chat_id = {int(chat_id)}")
        found = cur.fetchone() is not None
        cur.close()
        return found
    finally:
        conn.close()


def mark_greeted(chat_id, user_name: str, message_id: str, pinned: bool) -> None:
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    try:
        cur = conn.cursor()
        safe_name = str(user_name or '').replace("'", "''")[:200]
        safe_mid = str(message_id or '').replace("'", "''")[:200]
        cur.execute(
            f"INSERT INTO {SCHEMA}.max_greeted (chat_id, user_name, message_id, pinned) "
            f"VALUES ({int(chat_id)}, '{safe_name}', '{safe_mid}', {'TRUE' if pinned else 'FALSE'}) "
            f"ON CONFLICT (chat_id) DO NOTHING"
        )
        conn.commit()
        cur.close()
    finally:
        conn.close()


def greet_chat(chat_id, user_name: str) -> dict:
    """Отправляем блок заказа с кнопкой и закрепляем его в диалоге."""
    if already_greeted(chat_id):
        return {'ok': True, 'skipped': 'already greeted'}

    send = max_api(f'/messages?chat_id={chat_id}', {
        'text': GREET_TEXT,
        'attachments': [{
            'type': 'inline_keyboard',
            'payload': {
                'buttons': [[{'type': 'link', 'text': '🚕 Заказать такси', 'url': SITE_URL}]],
            },
        }],
    })

    message_id = ''
    msg = (send.get('message') or {}) if isinstance(send, dict) else {}
    body = msg.get('body') or {}
    message_id = body.get('mid') or ''

    if not message_id:
        print(f"[MAX-BOT] send failed chat={chat_id} err={str(send.get('error') or send)[:200]}")
        return {'ok': False, 'error': send}

    pin = max_api(f'/chats/{chat_id}/pin', {'message_id': message_id}, method='PUT')
    pinned = not pin.get('error')
    if not pinned:
        print(f"[MAX-BOT] pin failed chat={chat_id} err={str(pin.get('error'))[:200]}")

    mark_greeted(chat_id, user_name, message_id, pinned)
    print(f'[MAX-BOT] greet chat={chat_id} mid={message_id} pinned={pinned}')
    return {'ok': True, 'message_id': message_id, 'pinned': pinned}


def handler(event: dict, context) -> dict:
    """Приём событий бота MAX: первое сообщение клиента — блок заказа с кнопкой + закреп."""
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    qs = event.get('queryStringParameters') or {}

    # Служебный режим: подписать бота на события (webhook).
    if qs.get('action') == 'subscribe':
        url = qs.get('url') or ''
        res = max_api('/subscriptions', {'url': url, 'update_types': ['message_created', 'bot_started']})
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'result': res}, ensure_ascii=False)}

    if qs.get('action') == 'me':
        res = max_api('/me', None, method='GET')
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'result': res}, ensure_ascii=False)}

    if qs.get('action') == 'subscriptions':
        res = max_api('/subscriptions', None, method='GET')
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'result': res}, ensure_ascii=False)}

    try:
        update = json.loads(event.get('body') or '{}')
    except Exception:
        update = {}

    upd_type = update.get('update_type') or ''
    chat_id = None
    user_name = ''

    if upd_type == 'bot_started':
        chat_id = update.get('chat_id')
        user = update.get('user') or {}
        user_name = user.get('name') or user.get('username') or ''
    elif upd_type == 'message_created':
        msg = update.get('message') or {}
        recipient = msg.get('recipient') or {}
        sender = msg.get('sender') or {}
        # Только личные диалоги: в канале закреп не нужен.
        if recipient.get('chat_type') in ('dialog', 'private'):
            chat_id = recipient.get('chat_id')
            user_name = sender.get('name') or sender.get('username') or ''

    if not chat_id:
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'ok': True, 'skipped': upd_type})}

    result = greet_chat(chat_id, user_name)
    return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'ok': True, 'result': result}, ensure_ascii=False)}