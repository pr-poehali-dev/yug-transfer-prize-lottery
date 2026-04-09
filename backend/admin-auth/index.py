"""
Авторизация администратора. Проверяет логин/пароль и возвращает токен сессии.
"""
import os
import json
import hashlib
import secrets


CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Invalid JSON'})}

    login = body.get('login', '').strip()
    password = body.get('password', '').strip()

    admin_login = os.environ.get('ADMIN_LOGIN', '')
    admin_password = os.environ.get('ADMIN_PASSWORD', '')

    if login != admin_login or password != admin_password:
        return {
            'statusCode': 401,
            'headers': CORS,
            'body': json.dumps({'error': 'Неверный логин или пароль'}),
        }

    # Генерируем простой токен на основе секретов
    token_base = f"{admin_login}:{admin_password}:admin_secret_2026"
    token = hashlib.sha256(token_base.encode()).hexdigest()

    return {
        'statusCode': 200,
        'headers': CORS,
        'body': json.dumps({'ok': True, 'token': token}),
    }
