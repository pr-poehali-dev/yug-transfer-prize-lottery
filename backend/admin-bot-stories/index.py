"""Управление видео-сторис для канала @ug_transfer_pro. CRUD и ручная публикация."""
import os
import json
import hashlib
import uuid
import urllib.request
import urllib.error
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
    except urllib.error.HTTPError as e:
        try:
            err_body = e.read().decode()
            print(f"[tg_api {method}] HTTP {e.code}: {err_body}")
            return json.loads(err_body)
        except Exception:
            return {'ok': False, 'error': f'HTTP {e.code}'}
    except Exception as e:
        return {'ok': False, 'error': str(e)}


def tg_api_multipart(method: str, fields: dict, files: dict) -> dict:
    token = os.environ.get('TELEGRAM_BOT_TOKEN_2', '')
    url = f"https://api.telegram.org/bot{token}/{method}"
    boundary = uuid.uuid4().hex
    crlf = b'\r\n'
    body = b''
    for k, v in fields.items():
        body += b'--' + boundary.encode() + crlf
        body += f'Content-Disposition: form-data; name="{k}"'.encode() + crlf + crlf
        body += (v if isinstance(v, bytes) else str(v).encode()) + crlf
    for fname, (filename, fbytes, ctype) in files.items():
        body += b'--' + boundary.encode() + crlf
        body += f'Content-Disposition: form-data; name="{fname}"; filename="{filename}"'.encode() + crlf
        body += f'Content-Type: {ctype}'.encode() + crlf + crlf
        body += fbytes + crlf
    body += b'--' + boundary.encode() + b'--' + crlf

    req = urllib.request.Request(url, data=body, headers={
        'Content-Type': f'multipart/form-data; boundary={boundary}',
        'Content-Length': str(len(body)),
    }, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            err_body = e.read().decode()
            print(f"[tg_api_multipart {method}] HTTP {e.code}: {err_body}")
            return json.loads(err_body)
        except Exception:
            return {'ok': False, 'error': f'HTTP {e.code}'}
    except Exception as e:
        return {'ok': False, 'error': str(e)}


def post_story(video_url: str, caption: str) -> dict:
    """Публикует сторис в канал @ug_transfer_pro через postStory (chat_id канала)."""
    chat_id = '@ug_transfer_pro'

    try:
        with urllib.request.urlopen(video_url, timeout=30) as r:
            video_bytes = r.read()
        print(f"[post_story] downloaded {len(video_bytes)} bytes from {video_url}")
    except Exception as e:
        return {'ok': False, 'error': f'не удалось скачать видео: {e}'}

    content = {'type': 'video', 'video': 'attach://video_file'}
    if caption:
        content['caption'] = caption

    fields = {
        'chat_id': chat_id,
        'content': json.dumps(content),
        'active_period': '172800',
    }
    files = {'video_file': ('story.mp4', video_bytes, 'video/mp4')}
    return tg_api_multipart('postStory', fields, files)


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
        if method == 'GET' and action == 'connections':
            cur.execute(f"SELECT connection_id, user_id, username, is_enabled, can_reply, created_at FROM {SCHEMA}.business_connections ORDER BY id DESC LIMIT 20")
            rows = cur.fetchall()
            conns = [{
                'connection_id': r[0], 'user_id': r[1], 'username': r[2],
                'is_enabled': r[3], 'can_reply': r[4], 'created_at': r[5],
            } for r in rows]
            current = os.environ.get('TELEGRAM_BUSINESS_CONNECTION_ID', '').strip()
            return resp(200, {'connections': conns, 'current_secret': current})

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

            # Публикуем через user-аккаунт (Telethon) — обращаемся к tg-user-story
            user_story_url = 'https://functions.poehali.dev/e47b662c-3d9d-42c4-aa13-dda080f9a777'
            admin_login = os.environ.get('ADMIN_LOGIN', '')
            admin_password = os.environ.get('ADMIN_PASSWORD', '')
            admin_token = hashlib.sha256(f"{admin_login}:{admin_password}:admin_secret_2026".encode()).hexdigest()
            payload = json.dumps({'video_url': row[0], 'caption': row[1] or ''}).encode()
            req = urllib.request.Request(
                user_story_url,
                data=payload,
                headers={'Content-Type': 'application/json', 'X-Admin-Token': admin_token},
                method='POST',
            )
            try:
                with urllib.request.urlopen(req, timeout=120) as rr:
                    r = json.loads(rr.read())
            except urllib.error.HTTPError as e:
                try:
                    r = json.loads(e.read().decode())
                except Exception:
                    r = {'ok': False, 'error': f'HTTP {e.code}'}
            except Exception as e:
                r = {'ok': False, 'error': str(e)}

            tg_desc = r.get('description') or r.get('error') or 'unknown'
            status = 'ok' if r.get('ok') else f"err:{tg_desc}"
            cur.execute(f"UPDATE {SCHEMA}.bot_stories SET last_sent_at=NOW(), last_status='{esc(status)}', is_used=TRUE WHERE id={sid}")
            conn.commit()
            return resp(200, {'ok': r.get('ok', False), 'status': status, 'description': tg_desc, 'tg': r})

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