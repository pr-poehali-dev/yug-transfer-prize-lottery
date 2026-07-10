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
import hashlib
import base64
import uuid
import io
import psycopg2
import urllib.request
import urllib.parse
import boto3
from datetime import datetime, timezone, timedelta


CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
}

SCHEMA = 't_p67171637_yug_transfer_prize_l'


def verify_token(token: str) -> bool:
    if not token:
        return False
    admin_login = os.environ.get('ADMIN_LOGIN', '')
    admin_password = os.environ.get('ADMIN_PASSWORD', '')
    admin_tok = hashlib.sha256(f"{admin_login}:{admin_password}:admin_secret_2026".encode()).hexdigest()
    posts_login = os.environ.get('POSTS_LOGIN', '')
    posts_password = os.environ.get('POSTS_PASSWORD', '')
    posts_tok = hashlib.sha256(f"{posts_login}:{posts_password}:posts_secret_2026".encode()).hexdigest()
    return token == admin_tok or (bool(posts_login) and token == posts_tok)


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


def tg_request(bot_token: str, method: str, payload: dict, attempts: int = 2) -> dict:
    url = f"https://api.telegram.org/bot{bot_token}/{method}"
    data = json.dumps(payload).encode()
    last_err = 'timeout'
    for attempt in range(attempts):
        req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method='POST')
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            # Ошибка от самого Telegram (например, неверный parse_mode) — повтор не поможет.
            try:
                body = json.loads(e.read())
                return {'ok': False, 'description': body.get('description', str(e))}
            except Exception:
                return {'ok': False, 'description': str(e)}
        except Exception as e:
            # Таймаут/сетевая ошибка — пробуем ещё раз.
            last_err = str(e)
            continue
    return {'ok': False, 'description': last_err}


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


def normalize_button_url(url: str) -> str:
    """Telegram inline-кнопка требует полный URL. Превращаем @username / username / t.me/x в https://t.me/x."""
    u = (url or '').strip()
    if not u:
        return ''
    if u.startswith('http://') or u.startswith('https://'):
        return u
    if u.startswith('tg://'):
        return u
    if u.startswith('@'):
        return 'https://t.me/' + u[1:]
    if u.startswith('t.me/'):
        return 'https://' + u
    if u.startswith('www.t.me/'):
        return 'https://' + u[4:]
    if u.startswith('mailto:') or u.startswith('tel:'):
        return u
    # bare username (буквы/цифры/подчёркивания) -> telegram
    if all(ch.isalnum() or ch == '_' for ch in u):
        return 'https://t.me/' + u
    # иначе считаем веб-адресом без схемы
    return 'https://' + u


def publish_post(bot_token: str, channel_id: str, post: dict) -> dict:
    """Публикует пост в Telegram, возвращает {ok, message_id}"""
    text = build_text_with_title(post)
    photo_url = post.get('photo_url', '')
    video_note_url = post.get('video_note_url', '')
    button_text = post.get('button_text', '')
    button_url = post.get('button_url', '')
    button2_text = post.get('button2_text', '')
    button2_url = post.get('button2_url', '')

    button_url = normalize_button_url(button_url)
    button2_url = normalize_button_url(button2_url)

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
            text_msg_id = text_result.get('result', {}).get('message_id') if text_result.get('ok') else None
            msg_id = text_msg_id or video_msg_id
        else:
            msg_id = video_msg_id
            text_msg_id = None

        all_ids = [m for m in (video_msg_id, text_msg_id) if m]
        if msg_id:
            return {'ok': True, 'message_id': msg_id, 'message_ids': all_ids}
        return {'ok': False, 'error': video_result.get('description', 'Ошибка отправки видео-кружка')}

    # Telegram: подпись к фото ограничена 1024 символами, текст сообщения — 4096.
    # Если фото есть, но текст длиннее лимита подписи — шлём фото отдельно,
    # а длинный текст с кнопками отдельным сообщением.
    CAPTION_LIMIT = 1024
    long_with_photo = bool(photo_url) and len(text) > CAPTION_LIMIT

    if long_with_photo:
        photo_res = tg_request(bot_token, 'sendPhoto', {'chat_id': channel_id, 'photo': photo_url})
        photo_msg_id = photo_res.get('result', {}).get('message_id') if photo_res.get('ok') else None

        def try_send_text(parse_mode=None):
            payload = {'chat_id': channel_id, 'text': text}
            if parse_mode:
                payload['parse_mode'] = parse_mode
            if reply_markup:
                payload['reply_markup'] = reply_markup
            return tg_request(bot_token, 'sendMessage', payload)

        text_res = try_send_text('HTML')
        if not text_res.get('ok'):
            print(f"[POSTS] HTML parse failed: {text_res.get('description')}, retrying without parse_mode")
            text_res = try_send_text(None)

        text_msg_id = text_res.get('result', {}).get('message_id') if text_res.get('ok') else None
        msg_id = text_msg_id or photo_msg_id
        all_ids = [m for m in (photo_msg_id, text_msg_id) if m]
        if msg_id:
            return {'ok': True, 'message_id': msg_id, 'message_ids': all_ids}
        return {'ok': False, 'error': text_res.get('description') or photo_res.get('description', 'Unknown error')}

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
        return {'ok': True, 'message_id': msg_id, 'message_ids': [msg_id] if msg_id else []}
    return {'ok': False, 'error': result.get('description', 'Unknown error')}


def tg_delete_messages(bot_token: str, channel_id: str, message_ids: list) -> None:
    """Удаляет сообщения поста из Telegram-канала."""
    for mid in message_ids:
        if not mid:
            continue
        try:
            tg_request(bot_token, 'deleteMessage', {'chat_id': channel_id, 'message_id': mid})
        except Exception as e:
            print(f"[POSTS] deleteMessage {mid} failed: {e}")


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
        'auto_expire_at': r[15].isoformat() if len(r) > 15 and r[15] else None,
        'message_ids': list(r[16]) if len(r) > 16 and r[16] else [],
        'expired_at': r[17].isoformat() if len(r) > 17 and r[17] else None,
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
                       video_note_url, button2_text, button2_url, auto_expire_at, message_ids, expired_at
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
            f"SELECT id, title, text, photo_url, button_text, button_url, status, scheduled_at, published_at, telegram_message_id, created_at, updated_at, video_note_url, button2_text, button2_url, auto_expire_at, message_ids, expired_at FROM {SCHEMA}.posts WHERE id = %s",
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
        # Срок автоудаления: из тела запроса (expire_hours) или из сохранённого auto_expire_at
        expire_hours = body.get('expire_hours')
        expire_at = None
        if expire_hours:
            try:
                expire_at = now + timedelta(hours=float(expire_hours))
            except Exception:
                expire_at = None
        elif post.get('auto_expire_at'):
            try:
                stored = datetime.fromisoformat(post['auto_expire_at'])
                # если сохранён как «через N часов после публикации» — не знаем, поэтому берём как абсолютное будущее время
                if stored > now:
                    expire_at = stored
            except Exception:
                expire_at = None

        msg_ids = result.get('message_ids') or ([result.get('message_id')] if result.get('message_id') else [])
        cur.execute(
            f"UPDATE {SCHEMA}.posts SET status='published', published_at=%s, telegram_message_id=%s, message_ids=%s, auto_expire_at=%s, updated_at=%s WHERE id=%s",
            (now, result.get('message_id'), msg_ids, expire_at, now, post_id)
        )
        conn.commit()
        cur.close(); conn.close()
        print(f"[POSTS] published post {post_id}, msg_ids={msg_ids}, expire_at={expire_at}")
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'message_id': result.get('message_id')})}

    # ── POST ?action=check_scheduled — авто-публикация запланированных ──────
    if method == 'POST' and action == 'check_scheduled':
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        now = datetime.now(timezone.utc)
        cur.execute(
            f"SELECT id, title, text, photo_url, button_text, button_url, status, scheduled_at, published_at, telegram_message_id, created_at, updated_at, video_note_url, button2_text, button2_url, auto_expire_at, message_ids, expired_at FROM {SCHEMA}.posts WHERE status='scheduled' AND scheduled_at <= %s",
            (now,)
        )
        rows = cur.fetchall()
        published = []
        for row in rows:
            post = row_to_post(row)
            any_ok = False
            last_msg_id = None
            msg_ids = []
            if bot_token and channel_main:
                result = publish_post(bot_token, channel_main, post)
                if result['ok']:
                    any_ok = True
                    last_msg_id = result.get('message_id')
                    msg_ids = result.get('message_ids') or ([last_msg_id] if last_msg_id else [])
                    print(f"[POSTS] auto-published post {post['id']} to main")
            if any_ok:
                cur.execute(
                    f"UPDATE {SCHEMA}.posts SET status='published', published_at=%s, telegram_message_id=%s, message_ids=%s, updated_at=%s WHERE id=%s",
                    (now, last_msg_id, msg_ids, now, post['id'])
                )
                published.append(post['id'])
            else:
                cur.execute(
                    f"UPDATE {SCHEMA}.posts SET status='failed', updated_at=%s WHERE id=%s",
                    (now, post['id'])
                )

        # ── Автоудаление истёкших постов ────────────────────────────────────
        removed = []
        cur.execute(
            f"SELECT id, telegram_message_id, message_ids FROM {SCHEMA}.posts "
            f"WHERE status='published' AND auto_expire_at IS NOT NULL AND auto_expire_at <= %s AND expired_at IS NULL",
            (now,)
        )
        exp_rows = cur.fetchall()
        for exp in exp_rows:
            pid, single_id, ids = exp[0], exp[1], exp[2]
            to_delete = list(ids) if ids else ([single_id] if single_id else [])
            if bot_token and channel_main and to_delete:
                tg_delete_messages(bot_token, channel_main, to_delete)
            cur.execute(
                f"UPDATE {SCHEMA}.posts SET status='expired', expired_at=%s, updated_at=%s WHERE id=%s",
                (now, now, pid)
            )
            removed.append(pid)
            print(f"[POSTS] auto-expired post {pid}, deleted msgs={to_delete}")

        conn.commit()
        cur.close(); conn.close()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'published': published, 'expired': removed})}

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

        # Автоудаление: expire_hours (число часов) относительно времени публикации
        expire_hours = body.get('expire_hours')
        base_dt = sched_dt or datetime.now(timezone.utc)
        expire_at = None
        if expire_hours:
            try:
                expire_at = base_dt + timedelta(hours=float(expire_hours))
            except Exception:
                expire_at = None

        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(
            f"""INSERT INTO {SCHEMA}.posts (title, text, photo_url, video_note_url, button_text, button_url, button2_text, button2_url, status, scheduled_at, auto_expire_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
            (title, text, photo_url, video_note_url, button_text, button_url, button2_text, button2_url, status, sched_dt, expire_at)
        )
        new_id = cur.fetchone()[0]
        conn.commit()

        cur.execute(
            f"SELECT id, title, text, photo_url, button_text, button_url, status, scheduled_at, published_at, telegram_message_id, created_at, updated_at, video_note_url, button2_text, button2_url, auto_expire_at, message_ids, expired_at FROM {SCHEMA}.posts WHERE id=%s",
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
        expire_hours = body.get('expire_hours')
        base_dt = sched_dt or now
        expire_at = None
        if expire_hours:
            try:
                expire_at = base_dt + timedelta(hours=float(expire_hours))
            except Exception:
                expire_at = None
        cur.execute(
            f"""UPDATE {SCHEMA}.posts
                SET title=%s, text=%s, photo_url=%s, video_note_url=%s, button_text=%s, button_url=%s,
                    button2_text=%s, button2_url=%s, status=%s, scheduled_at=%s, auto_expire_at=%s, updated_at=%s
                WHERE id=%s""",
            (title, text, photo_url, video_note_url, button_text, button_url, button2_text, button2_url, status, sched_dt, expire_at, now, post_id)
        )
        conn.commit()

        cur.execute(
            f"SELECT id, title, text, photo_url, button_text, button_url, status, scheduled_at, published_at, telegram_message_id, created_at, updated_at, video_note_url, button2_text, button2_url, auto_expire_at, message_ids, expired_at FROM {SCHEMA}.posts WHERE id=%s",
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
        cur.execute(f"SELECT telegram_message_id, status, message_ids FROM {SCHEMA}.posts WHERE id=%s", (post_id,))
        row = cur.fetchone()
        tg_deleted = False
        if row and row[1] in ('published', 'expired') and bot_token and channel_main:
            to_delete = list(row[2]) if row[2] else ([row[0]] if row[0] else [])
            if to_delete:
                tg_delete_messages(bot_token, channel_main, to_delete)
                print(f"[POSTS] deleteMessage chat=main ids={to_delete}")
                tg_deleted = True

        cur.execute(f"DELETE FROM {SCHEMA}.posts WHERE id=%s", (post_id,))
        conn.commit()
        cur.close(); conn.close()
        print(f"[POSTS] deleted post {post_id}, tg_deleted={tg_deleted}")
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'tg_deleted': tg_deleted})}

    return {'statusCode': 405, 'headers': CORS, 'body': json.dumps({'error': 'Method not allowed'})}