"""Диагностика: проверяет, доступны ли серверы Telegram с сервера приложения."""
import json
import socket


def try_connect(host: str, port: int, timeout: float = 3.0) -> str:
    s = socket.socket()
    s.settimeout(timeout)
    try:
        s.connect((host, port))
        return 'ok'
    except Exception as e:
        return f'{type(e).__name__}: {e}'
    finally:
        s.close()


def handler(event: dict, context) -> dict:
    """Проверяет доступность адресов Telegram по разным портам."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }, 'body': ''}

    qs = event.get('queryStringParameters') or {}
    host = qs.get('host') or '149.154.167.51'
    port = int(qs.get('port') or 443)
    result = {f'{host}:{port}': try_connect(host, port, 3.0)}
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'isBase64Encoded': False,
        'body': json.dumps({'ok': True, 'result': result}, ensure_ascii=False),
    }
