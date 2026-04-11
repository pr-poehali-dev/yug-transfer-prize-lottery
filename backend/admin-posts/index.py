"""
Управление постами в Telegram-группу/канал.
GET — список постов с пагинацией.
POST — создать пост (черновик или запланировать).
PUT — обновить пост.
DELETE — удалить пост.
POST ?action=publish — немедленно опубликовать пост.
POST ?action=check_scheduled — проверить и опубликовать запланированные посты (cron-like).
"""
import os
import json
import hashlib
import psycopg2
import urllib.request
import urllib.parse
from datetime import datetime, timezone

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


def publish_post(bot_token: str, channel_id: str, post: dict) -> dict:
    """Публикует пост в Telegram, возвращает {ok, message_id}"""
    text = post.get('text', '')
    photo_url = post.get('photo_url', '')
    button_text = post.get('button_text', '')
    button_url = post.get('button_url', '')

    reply_markup = None
    if button_text and button_url:
        reply_markup = {'inline_keyboard': [[{'text': button_text, 'url': button_url}]]}

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
    text = post.get('text', '')
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

    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN', '')
    channel_main = os.environ.get('TELEGRAM_CHANNEL_ID', '')
    channel_kurilka = os.environ.get('TELEGRAM_CHANNEL_ID_2', '')

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
                       status, scheduled_at, published_at, telegram_message_id, created_at, updated_at
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

    # ── POST ?action=publish — немедленная публикация ───────────────────────
    if method == 'POST' and action == 'publish':
        body = json.loads(event.get('body') or '{}')
        post_id = body.get('post_id')
        chat = body.get('chat', 'main')
        if not post_id:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'post_id обязателен'})}

        channel_id = channel_kurilka if chat == 'kurilka' else channel_main

        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(
            f"SELECT id, title, text, photo_url, button_text, button_url, status, scheduled_at, published_at, telegram_message_id, created_at, updated_at FROM {SCHEMA}.posts WHERE id = %s",
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
            f"SELECT id, title, text, photo_url, button_text, button_url, status, scheduled_at, published_at, telegram_message_id, created_at, updated_at FROM {SCHEMA}.posts WHERE status='scheduled' AND scheduled_at <= %s",
            (now,)
        )
        rows = cur.fetchall()
        published = []
        for row in rows:
            post = row_to_post(row)
            if bot_token and channel_id:
                result = publish_post(bot_token, channel_id, post)
                if result['ok']:
                    cur.execute(
                        f"UPDATE {SCHEMA}.posts SET status='published', published_at=%s, telegram_message_id=%s, updated_at=%s WHERE id=%s",
                        (now, result.get('message_id'), now, post['id'])
                    )
                    published.append(post['id'])
                    print(f"[POSTS] auto-published post {post['id']}")
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
        button_text = body.get('button_text', '')
        button_url = body.get('button_url', '')
        status = body.get('status', 'draft')
        scheduled_at = body.get('scheduled_at')  # ISO string or None

        # Парсим scheduled_at
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
            f"""INSERT INTO {SCHEMA}.posts (title, text, photo_url, button_text, button_url, status, scheduled_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id""",
            (title, text, photo_url, button_text, button_url, status, sched_dt)
        )
        new_id = cur.fetchone()[0]
        conn.commit()

        cur.execute(
            f"SELECT id, title, text, photo_url, button_text, button_url, status, scheduled_at, published_at, telegram_message_id, created_at, updated_at FROM {SCHEMA}.posts WHERE id=%s",
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
        button_text = body.get('button_text', '')
        button_url = body.get('button_url', '')
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

        # Если нужно редактировать в Telegram
        if edit_in_tg:
            cur.execute(f"SELECT telegram_message_id FROM {SCHEMA}.posts WHERE id=%s", (post_id,))
            row = cur.fetchone()
            if row and row[0] and bot_token and channel_id:
                edit_tg_message(bot_token, channel_id, row[0], {'text': text, 'photo_url': photo_url})

        now = datetime.now(timezone.utc)
        cur.execute(
            f"""UPDATE {SCHEMA}.posts
                SET title=%s, text=%s, photo_url=%s, button_text=%s, button_url=%s,
                    status=%s, scheduled_at=%s, updated_at=%s
                WHERE id=%s""",
            (title, text, photo_url, button_text, button_url, status, sched_dt, now, post_id)
        )
        conn.commit()

        cur.execute(
            f"SELECT id, title, text, photo_url, button_text, button_url, status, scheduled_at, published_at, telegram_message_id, created_at, updated_at FROM {SCHEMA}.posts WHERE id=%s",
            (post_id,)
        )
        post = row_to_post(cur.fetchone())
        cur.close(); conn.close()
        print(f"[POSTS] updated post {post_id}, status={status}")
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'post': post})}

    # ── DELETE — удалить пост ───────────────────────────────────────────────
    if method == 'DELETE':
        body = json.loads(event.get('body') or '{}')
        post_id = body.get('id')
        if not post_id:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'id обязателен'})}

        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(f"DELETE FROM {SCHEMA}.posts WHERE id=%s", (post_id,))
        conn.commit()
        cur.close(); conn.close()
        print(f"[POSTS] deleted post {post_id}")
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

    return {'statusCode': 405, 'headers': CORS, 'body': json.dumps({'error': 'Method not allowed'})}