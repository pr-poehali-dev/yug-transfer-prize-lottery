"""
Одноразовый тест: отправляет пробное сообщение в канал @UG_DRIVER через @ug_info_bot
и сразу удаляет его. Возвращает результат.
"""
import os
import json
import urllib.request
import urllib.error


def tg(token: str, method: str, payload: dict) -> dict:
    url = f"https://api.telegram.org/bot{token}/{method}"
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read())
        except Exception:
            return {'ok': False, 'description': str(e)}
    except Exception as e:
        return {'ok': False, 'description': str(e)}


def handler(event: dict, context) -> dict:
    """Тест публикации и удаления сообщения новым ботом в канале UG_DRIVER."""
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    token = os.environ.get('UG_INFO_BOT_TOKEN', '')
    channel = os.environ.get('UG_DRIVER_CHANNEL_ID', '')

    result = {
        'token_present': bool(token),
        'channel_present': bool(channel),
        'channel': channel,
    }

    if not token or not channel:
        return {'statusCode': 200, 'headers': {**cors, 'Content-Type': 'application/json'}, 'body': json.dumps(result)}

    me = tg(token, 'getMe', {})
    result['getMe'] = me

    send = tg(token, 'sendMessage', {
        'chat_id': channel,
        'text': 'Тестовое сообщение от @ug_info_bot. Будет удалено через секунду.',
    })
    result['sendMessage'] = send

    if send.get('ok') and send.get('result', {}).get('message_id'):
        msg_id = send['result']['message_id']
        delete = tg(token, 'deleteMessage', {'chat_id': channel, 'message_id': msg_id})
        result['deleteMessage'] = delete

    return {
        'statusCode': 200,
        'headers': {**cors, 'Content-Type': 'application/json'},
        'body': json.dumps(result, ensure_ascii=False),
    }
