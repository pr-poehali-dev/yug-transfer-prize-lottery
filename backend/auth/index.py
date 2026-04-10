"""
Вход и регистрация по номеру телефона + пароль.
POST /login — вход по телефону и паролю
POST /register — регистрация нового пользователя
"""
import os
import json
import hashlib
import psycopg2


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def handler(event: dict, context) -> dict:
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    body = json.loads(event.get('body') or '{}')

    action = body.get('action', 'login')  # 'login' or 'register'
    phone = body.get('phone', '').strip().replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
    password = body.get('password', '').strip()
    first_name = body.get('first_name', '').strip()

    if not phone or not password:
        return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'ok': False, 'error': 'Заполни все поля'})}

    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()

    if action == 'register':
        if not first_name:
            return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'ok': False, 'error': 'Введи имя'})}
        if len(password) < 6:
            return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'ok': False, 'error': 'Пароль минимум 6 символов'})}

        cur.execute(f"SELECT id FROM {schema}.users WHERE phone = %s", (phone,))
        if cur.fetchone():
            cur.close(); conn.close()
            return {'statusCode': 409, 'headers': cors, 'body': json.dumps({'ok': False, 'error': 'Этот номер уже зарегистрирован'})}

        pw_hash = hash_password(password)
        cur.execute(f"""
            INSERT INTO {schema}.users (phone, password_hash, first_name)
            VALUES (%s, %s, %s)
            RETURNING id, phone, first_name, balance
        """, (phone, pw_hash, first_name))
        row = cur.fetchone()
        conn.commit()
        cur.close(); conn.close()
        user = {'id': row[0], 'telegram_id': 0, 'phone': row[1], 'first_name': row[2], 'balance': row[3], 'total_entries': 0, 'total_spent': 0, 'wins': 0}
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'ok': True, 'user': user})}

    else:
        pw_hash = hash_password(password)
        cur.execute(f"""
            SELECT id, phone, first_name, last_name, username, photo_url, balance
            FROM {schema}.users WHERE phone = %s AND password_hash = %s
        """, (phone, pw_hash))
        row = cur.fetchone()
        cur.close(); conn.close()

        if not row:
            return {'statusCode': 401, 'headers': cors, 'body': json.dumps({'ok': False, 'error': 'Неверный номер или пароль'})}

        user = {
            'id': row[0], 'telegram_id': 0, 'phone': row[1],
            'first_name': row[2] or '', 'last_name': row[3],
            'username': row[4], 'photo_url': row[5],
            'balance': row[6], 'total_entries': 0, 'total_spent': 0, 'wins': 0,
        }
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'ok': True, 'user': user})}