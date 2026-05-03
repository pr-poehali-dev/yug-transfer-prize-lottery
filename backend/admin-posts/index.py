"""
Управление постами в Telegram-группу/канал.
GET — список постов с пагинацией.
POST — создать пост (черновик или запланировать).
PUT — обновить пост.
DELETE — удалить пост.
POST ?action=publish — немедленно опубликовать пост.
POST ?action=upload_photo — загрузить фото в S3, вернуть CDN URL.
POST ?action=check_scheduled — проверить и опубликовать запланированные посты (cron-like).
"""
import os
import json
import re
import hashlib
import base64
import uuid
import io
import psycopg2
import urllib.request
import urllib.parse
import boto3
from datetime import datetime, timezone

VK_API_VERSION = '5.199'


CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
}

SCHEMA = 't_p67171637_yug_transfer_prize_l'


def verify_token(token: str) -> bool:
    admin_login = os.environ.get('ADMIN_LOGIN', '')
    admin_password = os.environ.get('ADMIN_PASSWORD', '')
    token_base = f"{admin_login}:{admin_password}:admin_secret_2026"
    return token == hashlib.sha256(token_base.encode()).hexdigest()


def tg_send_video_note(bot_token: str, channel_id: str, video_url: str) -> dict:
    """Скачивает видео и отправляет как video_note через multipart."""
    try:
        with urllib.request.urlopen(video_url, timeout=30) as r:
            video_bytes = r.read()
    except Exception as e:
        print(f"[POSTS] failed to download video: {e}")
        return {'ok': False, 'description': f'Не удалось скачать видео: {e}'}

    print(f"[POSTS] downloaded video: {len(video_bytes)} bytes")

    # Multipart form-data
    boundary = uuid.uuid4().hex
    ctype = f'multipart/form-data; boundary={boundary}'

    def field(name, value):
        return (
            f'--{boundary}\r\n'
            f'Content-Disposition: form-data; name="{name}"\r\n\r\n'
            f'{value}\r\n'
        ).encode()

    body = (
        field('chat_id', str(channel_id)) +
        f'--{boundary}\r\n'
        f'Content-Disposition: form-data; name="video_note"; filename="video.mp4"\r\n'
        f'Content-Type: video/mp4\r\n\r\n'.encode() +
        video_bytes +
        f'\r\n--{boundary}--\r\n'.encode()
    )

    url = f"https://api.telegram.org/bot{bot_token}/sendVideoNote"
    req = urllib.request.Request(url, data=body, headers={'Content-Type': ctype}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            body_err = json.loads(e.read())
            return {'ok': False, 'description': body_err.get('description', str(e))}
        except Exception:
            return {'ok': False, 'description': str(e)}
    except Exception as e:
        return {'ok': False, 'description': str(e)}


def tg_request(bot_token: str, method: str, payload: dict) -> dict:
    url = f"https://api.telegram.org/bot{bot_token}/{method}"
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read())
            return {'ok': False, 'description': body.get('description', str(e))}
        except Exception:
            return {'ok': False, 'description': str(e)}
    except Exception as e:
        return {'ok': False, 'description': str(e)}


def html_to_vk_text(html_text: str) -> str:
    """Конвертирует HTML-разметку Telegram в плоский текст для ВК."""
    if not html_text:
        return ''
    text = html_text
    text = re.sub(r'<a\s+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', r'\2 (\1)', text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'<[^>]+>', '', text)
    text = text.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"')
    return text.strip()


def vk_api(method: str, params: dict) -> dict:
    token = os.environ.get('VK_USER_TOKEN', '')
    if not token:
        return {'error': {'error_msg': 'VK_USER_TOKEN не задан'}}
    params = {**params, 'access_token': token, 'v': VK_API_VERSION}
    url = f"https://api.vk.com/method/{method}"
    data = urllib.parse.urlencode(params).encode()
    req = urllib.request.Request(url, data=data, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return {'error': {'error_msg': str(e)}}


def vk_upload_photo_to_wall(photo_url: str, user_id: str) -> str:
    """Загружает фото для постинга на стену пользователя. Возвращает attachment вида 'photoOWNER_ID'."""
    try:
        with urllib.request.urlopen(photo_url, timeout=15) as r:
            photo_bytes = r.read()
            content_type = r.headers.get('Content-Type', 'image/jpeg')
    except Exception as e:
        print(f"[VK] download photo failed: {e}")
        return ''

    server = vk_api('photos.getWallUploadServer', {})
    upload_url = server.get('response', {}).get('upload_url', '')
    if not upload_url:
        print(f"[VK] no upload_url: {server}")
        return ''

    boundary = uuid.uuid4().hex
    ext = 'jpg'
    if 'png' in content_type: ext = 'png'
    elif 'webp' in content_type: ext = 'webp'
    crlf = b'\r\n'
    body = b''
    body += b'--' + boundary.encode() + crlf
    body += f'Content-Disposition: form-data; name="photo"; filename="photo.{ext}"'.encode() + crlf
    body += f'Content-Type: {content_type}'.encode() + crlf + crlf
    body += photo_bytes + crlf
    body += b'--' + boundary.encode() + b'--' + crlf

    req = urllib.request.Request(upload_url, data=body, headers={
        'Content-Type': f'multipart/form-data; boundary={boundary}',
        'Content-Length': str(len(body)),
    }, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            uploaded = json.loads(resp.read())
    except Exception as e:
        print(f"[VK] upload failed: {e}")
        return ''

    saved = vk_api('photos.saveWallPhoto', {
        'user_id': user_id,
        'photo': uploaded.get('photo', ''),
        'server': uploaded.get('server', ''),
        'hash': uploaded.get('hash', ''),
    })
    items = saved.get('response', [])
    if not items:
        print(f"[VK] saveWallPhoto failed: {saved}")
        return ''
    item = items[0]
    return f"photo{item['owner_id']}_{item['id']}"


def publish_to_vk_user_wall(post: dict) -> dict:
    """Публикует пост на личную стену пользователя ВК."""
    user_id = os.environ.get('VK_USER_ID', '').strip()
    if not user_id:
        return {'ok': False, 'error': 'VK_USER_ID не задан'}
    if not os.environ.get('VK_USER_TOKEN', ''):
        return {'ok': False, 'error': 'VK_USER_TOKEN не задан'}

    raw_text = build_text_with_title(post)
    text = html_to_vk_text(raw_text)

    button_text = post.get('button_text', '')
    button_url = post.get('button_url', '')
    button2_text = post.get('button2_text', '')
    button2_url = post.get('button2_url', '')
    extras = []
    if button_text and button_url:
        extras.append(f"{button_text}: {button_url}")
    if button2_text and button2_url:
        extras.append(f"{button2_text}: {button2_url}")
    if extras:
        text = (text + "\n\n" if text else '') + "\n".join(extras)

    attachment = ''
    photo_url = post.get('photo_url', '')
    if photo_url:
        attachment = vk_upload_photo_to_wall(photo_url, user_id)

    params = {
        'owner_id': user_id,
        'message': text,
    }
    if attachment:
        params['attachments'] = attachment

    result = vk_api('wall.post', params)
    if 'response' in result:
        return {'ok': True, 'post_id': result['response'].get('post_id'), 'attachment': attachment}
    err = result.get('error', {}).get('error_msg', 'unknown')
    return {'ok': False, 'error': err, 'attachment': attachment}


def build_text_with_title(post: dict) -> str:
    """Добавляет title жирным заголовком в начало текста, если он есть."""
    title = (post.get('title') or '').strip()
    text = post.get('text', '') or ''
    if not title:
        return text
    # Если text уже начинается с этого заголовка (в любом виде) — не дублируем
    plain = text.lstrip()
    if plain.startswith(title) or plain.startswith(f'<b>{title}</b>'):
        return text
    return f'<b>{title}</b>\n\n{text}' if text.strip() else f'<b>{title}</b>'


def publish_post(bot_token: str, channel_id: str, post: dict) -> dict:
    """Публикует пост в Telegram, возвращает {ok, message_id}"""
    text = build_text_with_title(post)
    photo_url = post.get('photo_url', '')
    video_note_url = post.get('video_note_url', '')
    button_text = post.get('button_text', '')
    button_url = post.get('button_url', '')
    button2_text = post.get('button2_text', '')
    button2_url = post.get('button2_url', '')

    reply_markup = None
    buttons_row = []
    if button_text and button_url:
        buttons_row.append({'text': button_text, 'url': button_url})
    if button2_text and button2_url:
        buttons_row.append({'text': button2_text, 'url': button2_url})
    if buttons_row:
        reply_markup = {'inline_keyboard': [buttons_row]}

    # Если есть видео-кружок — сначала отправляем его, потом текст+кнопку
    if video_note_url:
        video_result = tg_send_video_note(bot_token, channel_id, video_note_url)
        print(f"[POSTS] sendVideoNote result: {video_result}")
        video_msg_id = video_result.get('result', {}).get('message_id') if video_result.get('ok') else None

        if text.strip() or reply_markup:
            btn_text = text.strip() if text.strip() else '\u200B'
            def try_send_text(parse_mode=None):
                payload = {'chat_id': channel_id, 'text': btn_text}
                if parse_mode and text.strip():
                    payload['parse_mode'] = parse_mode
                if reply_markup:
                    payload['reply_markup'] = reply_markup
                return tg_request(bot_token, 'sendMessage', payload)

            text_result = try_send_text('HTML')
            if not text_result.get('ok'):
                text_result = try_send_text(None)
            msg_id = text_result.get('result', {}).get('message_id') if text_result.get('ok') else video_msg_id
        else:
            msg_id = video_msg_id

        if msg_id:
            return {'ok': True, 'message_id': msg_id}
        return {'ok': False, 'error': video_result.get('description', 'Ошибка отправки видео-кружка')}

    def try_send(parse_mode=None):
        if photo_url:
            payload = {'chat_id': channel_id, 'photo': photo_url, 'caption': text}
            if parse_mode:
                payload['parse_mode'] = parse_mode
            if reply_markup:
                payload['reply_markup'] = reply_markup
            return tg_request(bot_token, 'sendPhoto', payload)
        else:
            payload = {'chat_id': channel_id, 'text': text}
            if parse_mode:
                payload['parse_mode'] = parse_mode
            if reply_markup:
                payload['reply_markup'] = reply_markup
            return tg_request(bot_token, 'sendMessage', payload)

    result = try_send('HTML')
    if not result.get('ok'):
        print(f"[POSTS] HTML parse failed: {result.get('description')}, retrying without parse_mode")
        result = try_send(None)

    if result.get('ok'):
        msg_id = result.get('result', {}).get('message_id')
        return {'ok': True, 'message_id': msg_id}
    return {'ok': False, 'error': result.get('description', 'Unknown error')}


def edit_tg_message(bot_token: str, channel_id: str, message_id: int, post: dict) -> dict:
    """Редактирует уже опубликованный пост в Telegram"""
    text = build_text_with_title(post)
    photo_url = post.get('photo_url', '')

    if photo_url:
        result = tg_request(bot_token, 'editMessageCaption', {
            'chat_id': channel_id, 'message_id': message_id,
            'caption': text, 'parse_mode': 'HTML',
        })
    else:
        result = tg_request(bot_token, 'editMessageText', {
            'chat_id': channel_id, 'message_id': message_id,
            'text': text, 'parse_mode': 'HTML',
        })
    return result


def row_to_post(r) -> dict:
    return {
        'id': r[0],
        'title': r[1] or '',
        'text': r[2] or '',
        'photo_url': r[3] or '',
        'button_text': r[4] or '',
        'button_url': r[5] or '',
        'status': r[6],
        'scheduled_at': r[7].isoformat() if r[7] else None,
        'published_at': r[8].isoformat() if r[8] else None,
        'telegram_message_id': r[9],
        'created_at': r[10].isoformat() if r[10] else None,
        'updated_at': r[11].isoformat() if r[11] else None,
        'video_note_url': r[12] or '',
        'button2_text': r[13] or '',
        'button2_url': r[14] or '',
    }


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    token = event.get('headers', {}).get('X-Admin-Token', '')
    if not verify_token(token):
        return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Unauthorized'})}

    method = event.get('httpMethod', 'GET')
    qs = event.get('queryStringParameters') or {}
    action = qs.get('action', '')

    bot_token = os.environ.get('UG_INFO_BOT_TOKEN_NEW', '') or os.environ.get('UG_INFO_BOT_TOKEN', '') or os.environ.get('TELEGRAM_BOT_TOKEN', '')
    channel_main = os.environ.get('UG_DRIVER_CHANNEL_ID', '') or os.environ.get('TELEGRAM_CHANNEL_ID', '')

    # ── GET — список постов ─────────────────────────────────────────────────
    if method == 'GET':
        page = int(qs.get('page', 1))
        limit = int(qs.get('limit', 30))
        status_filter = qs.get('status', '')
        offset = (page - 1) * limit

        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()

        where = ''
        args = []
        if status_filter:
            where = 'WHERE status = %s'
            args = [status_filter]

        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.posts {where}", args)
        total = cur.fetchone()[0]

        cur.execute(
            f"""SELECT id, title, text, photo_url, button_text, button_url,
                       status, scheduled_at, published_at, telegram_message_id, created_at, updated_at,
                       video_note_url, button2_text, button2_url
                FROM {SCHEMA}.posts {where}
                ORDER BY created_at DESC LIMIT %s OFFSET %s""",
            args + [limit, offset]
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()

        posts = [row_to_post(r) for r in rows]
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({
            'ok': True, 'posts': posts, 'total': total,
            'page': page, 'pages': max(1, (total + limit - 1) // limit)
        })}

    # ── POST ?action=upload_photo — загрузка фото в S3 ──────────────────────
    if method == 'POST' and action == 'upload_photo':
        body = json.loads(event.get('body') or '{}')
        data_url = body.get('image', '')
        if not data_url:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'image обязателен'})}

        if ',' in data_url:
            header, encoded = data_url.split(',', 1)
            ext = 'jpg'
            if 'png' in header:
                ext = 'png'
            elif 'gif' in header:
                ext = 'gif'
            elif 'webp' in header:
                ext = 'webp'
        else:
            encoded = data_url
            ext = 'jpg'

        image_bytes = base64.b64decode(encoded)
        key = f"posts/{uuid.uuid4()}.{ext}"
        content_type = f"image/{ext}"

        s3 = boto3.client(
            's3',
            endpoint_url='https://bucket.poehali.dev',
            aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
            aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
        )
        s3.put_object(Bucket='files', Key=key, Body=image_bytes, ContentType=content_type)
        cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
        print(f"[POSTS] uploaded photo: {cdn_url}")
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'url': cdn_url})}

    # ── POST ?action=upload_video — загрузка видео-кружка в S3 ──────────────
    if method == 'POST' and action == 'upload_video':
        body = json.loads(event.get('body') or '{}')
        data_url = body.get('video', '')
        if not data_url:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'video обязателен'})}

        if ',' in data_url:
            _, encoded = data_url.split(',', 1)
        else:
            encoded = data_url

        video_bytes = base64.b64decode(encoded)
        key = f"posts/video_{uuid.uuid4()}.mp4"

        s3 = boto3.client(
            's3',
            endpoint_url='https://bucket.poehali.dev',
            aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
            aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
        )
        s3.put_object(Bucket='files', Key=key, Body=video_bytes, ContentType='video/mp4')
        cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
        print(f"[POSTS] uploaded video note: {cdn_url}")
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'url': cdn_url})}

    # ── POST ?action=test_vk_user — тестовая отправка на ЛИЧНУЮ стену ВК ────
    if method == 'POST' and action == 'test_vk_user':
        body = json.loads(event.get('body') or '{}')
        post_id = body.get('post_id')
        if not post_id:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'post_id обязателен'})}

        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(
            f"SELECT id, title, text, photo_url, button_text, button_url, status, scheduled_at, published_at, telegram_message_id, created_at, updated_at, video_note_url, button2_text, button2_url FROM {SCHEMA}.posts WHERE id = %s",
            (post_id,)
        )
        row = cur.fetchone()
        cur.close(); conn.close()
        if not row:
            return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Пост не найден'})}

        post = row_to_post(row)
        print(f"[POSTS] TEST publish to VK personal wall for post {post_id}")
        result = publish_to_vk_user_wall(post)
        print(f"[POSTS] VK personal wall result: {result}")
        if not result['ok']:
            return {'statusCode': 500, 'headers': CORS, 'body': json.dumps({'ok': False, 'error': result.get('error', 'Ошибка ВК')})}
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'vk_post_id': result.get('post_id')})}

    # ── POST ?action=publish — немедленная публикация ───────────────────────
    if method == 'POST' and action == 'publish':
        body = json.loads(event.get('body') or '{}')
        post_id = body.get('post_id')
        chat = 'main'
        if not post_id:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'post_id обязателен'})}

        channel_id = channel_main

        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(
            f"SELECT id, title, text, photo_url, button_text, button_url, status, scheduled_at, published_at, telegram_message_id, created_at, updated_at, video_note_url, button2_text, button2_url FROM {SCHEMA}.posts WHERE id = %s",
            (post_id,)
        )
        row = cur.fetchone()
        if not row:
            cur.close(); conn.close()
            return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Пост не найден'})}

        post = row_to_post(row)

        if not bot_token or not channel_id:
            cur.close(); conn.close()
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Бот или канал не настроен'})}

        print(f"[POSTS] publishing post {post_id} to channel={channel_id}, chat={chat}")
        result = publish_post(bot_token, channel_id, post)
        print(f"[POSTS] publish result: {result}")
        if not result['ok']:
            cur.close(); conn.close()
            return {'statusCode': 500, 'headers': CORS, 'body': json.dumps({'error': result.get('error', 'Ошибка Telegram')})}

        now = datetime.now(timezone.utc)
        cur.execute(
            f"UPDATE {SCHEMA}.posts SET status='published', published_at=%s, telegram_message_id=%s, updated_at=%s WHERE id=%s",
            (now, result.get('message_id'), now, post_id)
        )
        conn.commit()
        cur.close(); conn.close()
        print(f"[POSTS] published post {post_id}, msg_id={result.get('message_id')}")
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'message_id': result.get('message_id')})}

    # ── POST ?action=check_scheduled — авто-публикация запланированных ──────
    if method == 'POST' and action == 'check_scheduled':
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        now = datetime.now(timezone.utc)
        cur.execute(
            f"SELECT id, title, text, photo_url, button_text, button_url, status, scheduled_at, published_at, telegram_message_id, created_at, updated_at, video_note_url, button2_text, button2_url FROM {SCHEMA}.posts WHERE status='scheduled' AND scheduled_at <= %s",
            (now,)
        )
        rows = cur.fetchall()
        published = []
        for row in rows:
            post = row_to_post(row)
            any_ok = False
            last_msg_id = None
            if bot_token and channel_main:
                result = publish_post(bot_token, channel_main, post)
                if result['ok']:
                    any_ok = True
                    last_msg_id = result.get('message_id')
                    print(f"[POSTS] auto-published post {post['id']} to main")
            if any_ok:
                cur.execute(
                    f"UPDATE {SCHEMA}.posts SET status='published', published_at=%s, telegram_message_id=%s, updated_at=%s WHERE id=%s",
                    (now, last_msg_id, now, post['id'])
                )
                published.append(post['id'])
            else:
                cur.execute(
                    f"UPDATE {SCHEMA}.posts SET status='failed', updated_at=%s WHERE id=%s",
                    (now, post['id'])
                )
        conn.commit()
        cur.close(); conn.close()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'published': published})}

    # ── POST — создать пост ─────────────────────────────────────────────────
    if method == 'POST':
        body = json.loads(event.get('body') or '{}')
        text = body.get('text', '').strip()
        if not text:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'text обязателен'})}

        title = body.get('title', '').strip()
        photo_url = body.get('photo_url', '')
        video_note_url = body.get('video_note_url', '')
        button_text = body.get('button_text', '')
        button_url = body.get('button_url', '')
        button2_text = body.get('button2_text', '')
        button2_url = body.get('button2_url', '')
        status = body.get('status', 'draft')
        scheduled_at = body.get('scheduled_at')
        sched_dt = None
        if scheduled_at:
            try:
                sched_dt = datetime.fromisoformat(scheduled_at.replace('Z', '+00:00'))
                status = 'scheduled'
            except Exception:
                sched_dt = None

        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(
            f"""INSERT INTO {SCHEMA}.posts (title, text, photo_url, video_note_url, button_text, button_url, button2_text, button2_url, status, scheduled_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
            (title, text, photo_url, video_note_url, button_text, button_url, button2_text, button2_url, status, sched_dt)
        )
        new_id = cur.fetchone()[0]
        conn.commit()

        cur.execute(
            f"SELECT id, title, text, photo_url, button_text, button_url, status, scheduled_at, published_at, telegram_message_id, created_at, updated_at, video_note_url, button2_text, button2_url FROM {SCHEMA}.posts WHERE id=%s",
            (new_id,)
        )
        post = row_to_post(cur.fetchone())
        cur.close(); conn.close()
        print(f"[POSTS] created post {new_id}, status={status}")
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'post': post})}

    # ── PUT — обновить пост ─────────────────────────────────────────────────
    if method == 'PUT':
        body = json.loads(event.get('body') or '{}')
        post_id = body.get('id')
        if not post_id:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'id обязателен'})}

        title = body.get('title', '')
        text = body.get('text', '').strip()
        photo_url = body.get('photo_url', '')
        video_note_url = body.get('video_note_url', '')
        button_text = body.get('button_text', '')
        button_url = body.get('button_url', '')
        button2_text = body.get('button2_text', '')
        button2_url = body.get('button2_url', '')
        status = body.get('status', 'draft')
        scheduled_at = body.get('scheduled_at')
        edit_in_tg = body.get('edit_in_telegram', False)

        sched_dt = None
        if scheduled_at:
            try:
                sched_dt = datetime.fromisoformat(scheduled_at.replace('Z', '+00:00'))
                if status == 'draft':
                    status = 'scheduled'
            except Exception:
                sched_dt = None

        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()

        if edit_in_tg:
            cur.execute(f"SELECT telegram_message_id FROM {SCHEMA}.posts WHERE id=%s", (post_id,))
            row = cur.fetchone()
            if row and row[0] and bot_token and channel_main:
                msg_id = row[0]
                edit_tg_message(bot_token, channel_main, msg_id, {'text': text, 'photo_url': photo_url})

        now = datetime.now(timezone.utc)
        cur.execute(
            f"""UPDATE {SCHEMA}.posts
                SET title=%s, text=%s, photo_url=%s, video_note_url=%s, button_text=%s, button_url=%s,
                    button2_text=%s, button2_url=%s, status=%s, scheduled_at=%s, updated_at=%s
                WHERE id=%s""",
            (title, text, photo_url, video_note_url, button_text, button_url, button2_text, button2_url, status, sched_dt, now, post_id)
        )
        conn.commit()

        cur.execute(
            f"SELECT id, title, text, photo_url, button_text, button_url, status, scheduled_at, published_at, telegram_message_id, created_at, updated_at, video_note_url, button2_text, button2_url FROM {SCHEMA}.posts WHERE id=%s",
            (post_id,)
        )
        post = row_to_post(cur.fetchone())
        cur.close(); conn.close()
        print(f"[POSTS] updated post {post_id}, status={status}")
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'post': post})}

    # ── DELETE — удалить пост (из Telegram + из базы) ───────────────────────
    if method == 'DELETE':
        body = json.loads(event.get('body') or '{}')
        post_id = body.get('id')
        if not post_id:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'id обязателен'})}

        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(f"SELECT telegram_message_id, status FROM {SCHEMA}.posts WHERE id=%s", (post_id,))
        row = cur.fetchone()
        tg_deleted = False
        if row and row[0] and row[1] == 'published' and bot_token and channel_main:
            msg_id = row[0]
            result = tg_request(bot_token, 'deleteMessage', {'chat_id': channel_main, 'message_id': msg_id})
            print(f"[POSTS] deleteMessage chat=main msg_id={msg_id}: {result}")
            if result.get('ok'):
                tg_deleted = True

        cur.execute(f"DELETE FROM {SCHEMA}.posts WHERE id=%s", (post_id,))
        conn.commit()
        cur.close(); conn.close()
        print(f"[POSTS] deleted post {post_id}, tg_deleted={tg_deleted}")
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'tg_deleted': tg_deleted})}

    return {'statusCode': 405, 'headers': CORS, 'body': json.dumps({'error': 'Method not allowed'})}