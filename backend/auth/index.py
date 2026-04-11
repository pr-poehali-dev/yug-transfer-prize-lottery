"""
Вход, регистрация и редактирование профиля по номеру телефона.
action=login — вход по телефону и паролю
action=register — регистрация нового пользователя
action=update_profile — обновление имени, телефона, пароля, фото
"""
import os
import json
import hashlib
import base64
import boto3
import psycopg2


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def upload_photo(data_url: str, user_id: int) -> str:
    header, encoded = data_url.split(',', 1)
    ext = 'jpg' if 'jpeg' in header else 'png'
    data = base64.b64decode(encoded)
    s3 = boto3.client('s3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'])
    key = f'avatars/user_{user_id}.{ext}'
    s3.put_object(Bucket='files', Key=key, Body=data, ContentType=f'image/{ext}')
    return f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"


def handler(event: dict, context) -> dict:
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    body = json.loads(event.get('body') or '{}')
    action = body.get('action', 'login')
    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')

    # Привязка Telegram к существующему аккаунту
    if action == 'link_telegram':
        user_id = int(body.get('user_id', 0))
        telegram_id = int(body.get('telegram_id', 0))
        username = body.get('username', '')
        photo_url = body.get('photo_url', '')
        if not user_id or not telegram_id:
            return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'ok': False, 'error': 'Нет данных'})}
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        updates = ['telegram_id = %s', 'updated_at = NOW()']
        params = [telegram_id]
        if username:
            updates.append('username = %s')
            params.append(username)
        if photo_url:
            updates.append('photo_url = %s')
            params.append(photo_url)
        params.append(user_id)
        cur.execute(f"UPDATE {schema}.users SET {', '.join(updates)} WHERE id = %s", params)
        conn.commit()
        cur.close(); conn.close()
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'ok': True})}

    # Обновление профиля
    if action == 'update_profile':
        user_id = int(body.get('user_id', 0))
        first_name = body.get('first_name', '').strip()
        phone = body.get('phone', '').strip()
        new_password = body.get('new_password', '').strip()
        old_password = body.get('old_password', '').strip()
        photo_data = body.get('photo_data', '')

        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()

        photo_url = None
        if photo_data and photo_data.startswith('data:'):
            photo_url = upload_photo(photo_data, user_id)

        updates = ['first_name = %s', 'updated_at = NOW()']
        params = [first_name]

        if phone:
            updates.append('phone = %s')
            params.append(phone)

        if photo_url:
            updates.append('photo_url = %s')
            params.append(photo_url)

        if new_password:
            if len(new_password) < 6:
                cur.close(); conn.close()
                return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'ok': False, 'error': 'Новый пароль минимум 6 символов'})}
            cur.execute(f"SELECT password_hash FROM {schema}.users WHERE id = %s", (user_id,))
            row = cur.fetchone()
            if row and row[0] and row[0] != hash_password(old_password):
                cur.close(); conn.close()
                return {'statusCode': 401, 'headers': cors, 'body': json.dumps({'ok': False, 'error': 'Неверный текущий пароль'})}
            updates.append('password_hash = %s')
            params.append(hash_password(new_password))

        params.append(user_id)
        cur.execute(f"UPDATE {schema}.users SET {', '.join(updates)} WHERE id = %s", params)
        conn.commit()
        cur.close(); conn.close()
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'ok': True, 'photo_url': photo_url})}

    raw_phone = body.get('phone', '')
    phone = raw_phone.strip().replace(' ', '').replace('-', '').replace('(', '').replace(')', '').replace('+', '')
    password = body.get('password', '').strip()
    first_name = body.get('first_name', '').strip()

    print(f"[AUTH] action={action} raw_phone={raw_phone!r} phone={phone!r}")

    if not phone or not password:
        return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'ok': False, 'error': 'Заполни все поля'})}

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()

    if action == 'register':
        if not first_name:
            cur.close(); conn.close()
            return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'ok': False, 'error': 'Введи имя'})}
        if len(password) < 6:
            cur.close(); conn.close()
            return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'ok': False, 'error': 'Пароль минимум 6 символов'})}

        cur.execute(f"SELECT id, phone FROM {schema}.users", )
        all_phones = cur.fetchall()
        print(f"[AUTH] all phones in DB: {all_phones}")
        cur.execute(f"SELECT id FROM {schema}.users WHERE phone = %s", (phone,))
        if cur.fetchone():
            cur.close(); conn.close()
            return {'statusCode': 409, 'headers': cors, 'body': json.dumps({'ok': False, 'error': 'Этот номер уже зарегистрирован'})}

        pw_hash = hash_password(password)
        try:
            print(f"[AUTH] inserting phone={phone!r} first_name={first_name!r}")
            cur.execute(f"""
                INSERT INTO {schema}.users (phone, password_hash, first_name)
                VALUES (%s, %s, %s)
                RETURNING id, phone, first_name, balance
            """, (phone, pw_hash, first_name))
            row = cur.fetchone()
            conn.commit()
            print(f"[AUTH] insert ok, row={row}")
        except Exception as e:
            conn.rollback()
            print(f"[AUTH] insert ERROR: {type(e).__name__}: {e}")
            cur.close(); conn.close()
            return {'statusCode': 500, 'headers': cors, 'body': json.dumps({'ok': False, 'error': f'Ошибка БД: {type(e).__name__}: {str(e)}'})}
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