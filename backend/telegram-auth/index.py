"""
Авторизация через Telegram Login Widget.
Проверяет подпись данных от Telegram, сохраняет/обновляет пользователя в БД,
возвращает данные пользователя.
"""
import os
import json
import hashlib
import hmac
import urllib.parse
import psycopg2
from datetime import datetime, timezone


def handler(event: dict, context) -> dict:
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'error': 'Invalid JSON'})}

    # Проверяем подпись Telegram
    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN', '')
    secret_key = hashlib.sha256(bot_token.encode()).digest()

    hash_value = body.pop('hash', '')
    check_string = '\n'.join(f'{k}={v}' for k, v in sorted(body.items()))
    computed = hmac.new(secret_key, check_string.encode(), hashlib.sha256).hexdigest()

    if computed != hash_value:
        return {'statusCode': 401, 'headers': cors, 'body': json.dumps({'error': 'Invalid Telegram signature'})}

    # Проверяем актуальность данных (не старше 24 часов)
    auth_date = int(body.get('auth_date', 0))
    now = int(datetime.now(timezone.utc).timestamp())
    if now - auth_date > 86400:
        return {'statusCode': 401, 'headers': cors, 'body': json.dumps({'error': 'Auth data expired'})}

    telegram_id = int(body.get('id'))
    first_name = body.get('first_name', '')
    last_name = body.get('last_name', '')
    username = body.get('username', '')
    photo_url = body.get('photo_url', '')

    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()

    cur.execute(f"""
        INSERT INTO {schema}.users (telegram_id, first_name, last_name, username, photo_url, updated_at)
        VALUES (%s, %s, %s, %s, %s, NOW())
        ON CONFLICT (telegram_id) DO UPDATE SET
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            username = EXCLUDED.username,
            photo_url = EXCLUDED.photo_url,
            updated_at = NOW()
        RETURNING id, telegram_id, first_name, last_name, username, photo_url, created_at
    """, (telegram_id, first_name, last_name, username, photo_url))

    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()

    user = {
        'id': row[0],
        'telegram_id': row[1],
        'first_name': row[2],
        'last_name': row[3],
        'username': row[4],
        'photo_url': row[5],
        'created_at': row[6].isoformat() if row[6] else None,
    }

    return {
        'statusCode': 200,
        'headers': cors,
        'body': json.dumps({'ok': True, 'user': user}),
    }