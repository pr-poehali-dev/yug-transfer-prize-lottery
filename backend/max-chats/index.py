"""Вспомогательная функция: показывает список чатов/каналов MAX, куда добавлен бот, с их ID."""
import os
import json
import urllib.request
import urllib.parse


CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

API_BASE = 'https://botapi.max.ru'


def handler(event: dict, context) -> dict:
    """Возвращает список чатов бота MAX с их ID, чтобы узнать MAX_CHAT_ID."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    token = os.environ.get('MAX_BOT_TOKEN', '').strip()
    if not token:
        return {
            'statusCode': 200,
            'headers': {**CORS, 'Content-Type': 'application/json'},
            'body': json.dumps({'ok': False, 'error': 'MAX_BOT_TOKEN не задан'}, ensure_ascii=False),
        }

    url = f"{API_BASE}/chats?access_token={urllib.parse.quote(token)}&count=50"
    try:
        req = urllib.request.Request(url, method='GET')
        with urllib.request.urlopen(req, timeout=15) as r:
            raw = r.read().decode('utf-8')
        data = json.loads(raw)
    except Exception as e:
        return {
            'statusCode': 200,
            'headers': {**CORS, 'Content-Type': 'application/json'},
            'body': json.dumps({'ok': False, 'error': str(e)}, ensure_ascii=False),
        }

    chats = []
    for c in data.get('chats', []):
        chats.append({
            'chat_id': c.get('chat_id'),
            'title': c.get('title'),
            'type': c.get('type'),
            'link': c.get('link'),
            'status': c.get('status'),
        })

    return {
        'statusCode': 200,
        'headers': {**CORS, 'Content-Type': 'application/json'},
        'body': json.dumps({'ok': True, 'chats': chats}, ensure_ascii=False),
    }
