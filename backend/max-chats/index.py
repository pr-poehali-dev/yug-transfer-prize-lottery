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

    raw_token = os.environ.get('MAX_BOT_TOKEN', '')
    token = raw_token.strip()
    diag = {
        'token_present': bool(raw_token),
        'token_len': len(token),
        'had_whitespace': raw_token != token,
        'token_preview': (token[:4] + '...' + token[-4:]) if len(token) > 8 else '',
    }
    if not token:
        return {
            'statusCode': 200,
            'headers': {**CORS, 'Content-Type': 'application/json'},
            'body': json.dumps({'ok': False, 'error': 'MAX_BOT_TOKEN не задан', 'diag': diag}, ensure_ascii=False),
        }

    me_info = {}
    try:
        me_url = f"{API_BASE}/me?access_token={urllib.parse.quote(token)}"
        me_req = urllib.request.Request(me_url, method='GET')
        with urllib.request.urlopen(me_req, timeout=15) as r:
            me_info = json.loads(r.read().decode('utf-8'))
    except Exception as e:
        me_info = {'error': str(e)}

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
            'body': json.dumps({'ok': False, 'error': str(e), 'diag': diag, 'me': me_info}, ensure_ascii=False),
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
        'body': json.dumps({'ok': True, 'chats': chats, 'diag': diag, 'me': me_info}, ensure_ascii=False),
    }