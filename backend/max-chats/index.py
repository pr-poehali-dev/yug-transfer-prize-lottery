"""Вспомогательная функция: показывает список чатов/каналов MAX, куда добавлен бот, с их ID."""
import os
import json
import urllib.request
import urllib.parse
import urllib.error


CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

def try_request(url: str, use_header: bool, token: str):
    """Пробует GET-запрос либо с токеном в заголовке, либо в query."""
    if use_header:
        req = urllib.request.Request(url, method='GET')
        req.add_header('Authorization', token)
    else:
        sep = '&' if '?' in url else '?'
        req = urllib.request.Request(f"{url}{sep}access_token={urllib.parse.quote(token)}", method='GET')
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return {'status': r.status, 'body': json.loads(r.read().decode('utf-8'))}
    except urllib.error.HTTPError as e:
        try:
            err_body = e.read().decode('utf-8')
        except Exception:
            err_body = ''
        return {'status': e.code, 'error': str(e), 'body': err_body}
    except Exception as e:
        return {'error': str(e)}


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

    bases = ['https://platform-api.max.ru', 'https://botapi.max.ru']
    attempts = []
    chats_result = None
    for base in bases:
        for use_header in (True, False):
            res = try_request(f"{base}/chats?count=50", use_header, token)
            attempts.append({
                'base': base,
                'auth': 'header' if use_header else 'query',
                'status': res.get('status'),
                'error': res.get('error'),
            })
            body = res.get('body')
            if res.get('status') == 200 and isinstance(body, dict) and 'chats' in body:
                chats_result = body
                break
        if chats_result:
            break

    if not chats_result:
        return {
            'statusCode': 200,
            'headers': {**CORS, 'Content-Type': 'application/json'},
            'body': json.dumps({'ok': False, 'error': 'не удалось получить чаты', 'diag': diag, 'attempts': attempts}, ensure_ascii=False),
        }

    chats = []
    for c in chats_result.get('chats', []):
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
        'body': json.dumps({'ok': True, 'chats': chats, 'diag': diag, 'attempts': attempts}, ensure_ascii=False),
    }