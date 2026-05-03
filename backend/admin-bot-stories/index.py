"""Управление видео-сторис для канала @ug_transfer_pro. CRUD и ручная публикация."""
import os
import json
import hashlib
import urllib.request
import psycopg2

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
}

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')
CHANNEL_ID = '@ug_transfer_pro'


def verify_token(token: str) -> bool:
    admin_login = os.environ.get('ADMIN_LOGIN', '')
    admin_password = os.environ.get('ADMIN_PASSWORD', '')
    token_base = f"{admin_login}:{admin_password}:admin_secret_2026"
    return token == hashlib.sha256(token_base.encode()).hexdigest()


def esc(value) -> str:
    if value is None:
        return ''
    return str(value).replace("'", "''")


def resp(status: int, body: dict) -> dict:
    return {'statusCode': status, 'headers': CORS, 'body': json.dumps(body, default=str)}


def tg_api(method: str, payload: dict) -> dict:
    token = os.environ.get('TELEGRAM_BOT_TOKEN_2', '')
    url = f"https://api.telegram.org/bot{token}/{method}"
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except Exception as e:
        return {'ok': False, 'error': str(e)}


def post_story(video_url: str, caption: str) -> dict:
    """Публикует сторис в канал. Требует Business Connection (Telegram Premium у владельца).
    Если business_connection_id не настроен — возвращает понятную ошибку."""
    business_id = os.environ.get('TELEGRAM_BUSINESS_CONNECTION_ID', '').strip()
    if not business_id:
        return {'ok': False, 'error': 'TELEGRAM_BUSINESS_CONNECTION_ID не задан. Сторис в канал требует подключения Business аккаунта Telegram.'}
    payload = {
        'business_connection_id': business_id,
        'content': {'type': 'video', 'video': video_url},
        'active_period': 172800,  # 48 часов
    }
    if caption:
        payload['caption'] = caption
    result = tg_api('postStory', payload)
    return result


def handler(event: dict, context) -> dict:
    """CRUD для сторис и ручная отправка. method=GET список, POST создать, PUT обновить, DELETE удалить, POST ?action=send_now отправить."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {**CORS, 'Access-Control-Max-Age': '86400'}, 'body': ''}

    headers = event.get('headers') or {}
    token = headers.get('x-admin-token') or headers.get('X-Admin-Token') or ''
    if not verify_token(token):
        return resp(401, {'error': 'unauthorized'})

    method = event.get('httpMethod', 'GET')
    qs = event.get('queryStringParameters') or {}
    action = qs.get('action', '')

    dsn = os.environ['DATABASE_URL']
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()

    try:
        if method == 'GET':
            cur.execute(f"SELECT id, video_url, caption, is_used, last_sent_at, last_status, created_at FROM {SCHEMA}.bot_stories ORDER BY id DESC")
            rows = cur.fetchall()
            items = [{
                'id': r[0], 'video_url': r[1], 'caption': r[2], 'is_used': r[3],
                'last_sent_at': r[4], 'last_status': r[5], 'created_at': r[6],
            } for r in rows]
            return resp(200, {'items': items})

        body = json.loads(event.get('body') or '{}')

        if method == 'POST' and action == 'send_now':
            sid = int(body.get('id', 0))
            cur.execute(f"SELECT video_url, caption FROM {SCHEMA}.bot_stories WHERE id={sid}")
            row = cur.fetchone()
            if not row:
                return resp(404, {'error': 'not_found'})
            r = post_story(row[0], row[1] or '')
            status = 'ok' if r.get('ok') else f"err:{r.get('error') or r.get('description', 'unknown')}"
            cur.execute(f"UPDATE {SCHEMA}.bot_stories SET last_sent_at=NOW(), last_status='{esc(status)}', is_used=TRUE WHERE id={sid}")
            conn.commit()
            return resp(200, {'ok': r.get('ok', False), 'status': status, 'tg': r})

        if method == 'POST':
            video_url = body.get('video_url', '').strip()
            caption = body.get('caption', '').strip()
            if not video_url:
                return resp(400, {'error': 'video_url required'})
            cur.execute(f"INSERT INTO {SCHEMA}.bot_stories (video_url, caption) VALUES ('{esc(video_url)}', '{esc(caption)}') RETURNING id")
            new_id = cur.fetchone()[0]
            conn.commit()
            return resp(200, {'ok': True, 'id': new_id})

        if method == 'PUT':
            sid = int(body.get('id', 0))
            video_url = body.get('video_url', '').strip()
            caption = body.get('caption', '').strip()
            cur.execute(f"UPDATE {SCHEMA}.bot_stories SET video_url='{esc(video_url)}', caption='{esc(caption)}' WHERE id={sid}")
            conn.commit()
            return resp(200, {'ok': True})

        if method == 'DELETE':
            sid = int(qs.get('id', 0))
            cur.execute(f"DELETE FROM {SCHEMA}.bot_stories WHERE id={sid}")
            conn.commit()
            return resp(200, {'ok': True})

        return resp(405, {'error': 'method not allowed'})
    finally:
        cur.close()
        conn.close()
