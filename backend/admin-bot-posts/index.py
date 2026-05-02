"""Управление ежедневными постами бота @ug_sait_bot для группы @ug_transfer_pro."""
import os
import json
import hashlib
import psycopg2


CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
}

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')


def verify_token(token: str) -> bool:
    admin_login = os.environ.get('ADMIN_LOGIN', '')
    admin_password = os.environ.get('ADMIN_PASSWORD', '')
    token_base = f"{admin_login}:{admin_password}:admin_secret_2026"
    return token == hashlib.sha256(token_base.encode()).hexdigest()


def escape_sql(value: str) -> str:
    """Escape single quotes for SQL by doubling them."""
    if value is None:
        return ''
    return str(value).replace("'", "''")


def resp(status: int, body: dict) -> dict:
    return {
        'statusCode': status,
        'headers': CORS,
        'body': json.dumps(body, default=str),
    }


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
                'Access-Control-Max-Age': '86400',
            },
            'body': '',
        }

    token = event.get('headers', {}).get('X-Admin-Token', '')
    if not verify_token(token):
        return resp(401, {'error': 'Unauthorized'})

    method = event.get('httpMethod', 'GET')

    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
    except Exception as e:
        print(f"[ADMIN-BOT-POSTS] DB connection error: {e}")
        return resp(500, {'error': 'Database connection failed'})

    try:
        # ── GET — список всех постов ──
        if method == 'GET':
            cur.execute(
                f"SELECT id, photo_url, greeting, description, is_used, scheduled_date, created_at, "
                f"last_tg_status, last_vk_status, last_sent_at "
                f"FROM {SCHEMA}.bot_daily_posts ORDER BY id DESC"
            )
            rows = cur.fetchall()
            posts = []
            for r in rows:
                posts.append({
                    'id': r[0],
                    'photo_url': r[1] or '',
                    'greeting': r[2] or '',
                    'description': r[3] or '',
                    'is_used': r[4],
                    'scheduled_date': r[5].isoformat() if r[5] else None,
                    'created_at': r[6].isoformat() if r[6] else None,
                    'last_tg_status': r[7],
                    'last_vk_status': r[8],
                    'last_sent_at': r[9].isoformat() if r[9] else None,
                })
            cur.close()
            conn.close()
            return resp(200, {'ok': True, 'posts': posts})

        # ── POST — создать новый пост ──
        if method == 'POST':
            try:
                body = json.loads(event.get('body') or '{}')
            except Exception:
                cur.close()
                conn.close()
                return resp(400, {'error': 'Invalid JSON'})

            photo_url = escape_sql(body.get('photo_url', ''))
            greeting = escape_sql(body.get('greeting', ''))
            description = escape_sql(body.get('description', ''))

            if not photo_url or not greeting or not description:
                cur.close()
                conn.close()
                return resp(400, {'error': 'photo_url, greeting и description обязательны'})

            cur.execute(
                f"INSERT INTO {SCHEMA}.bot_daily_posts (photo_url, greeting, description) "
                f"VALUES ('{photo_url}', '{greeting}', '{description}') "
                f"RETURNING id, photo_url, greeting, description, is_used, scheduled_date, created_at"
            )
            r = cur.fetchone()
            conn.commit()
            post = {
                'id': r[0],
                'photo_url': r[1] or '',
                'greeting': r[2] or '',
                'description': r[3] or '',
                'is_used': r[4],
                'scheduled_date': r[5].isoformat() if r[5] else None,
                'created_at': r[6].isoformat() if r[6] else None,
            }
            cur.close()
            conn.close()
            print(f"[ADMIN-BOT-POSTS] created post id={post['id']}")
            return resp(201, {'ok': True, 'post': post})

        # ── PUT — обновить пост ──
        if method == 'PUT':
            try:
                body = json.loads(event.get('body') or '{}')
            except Exception:
                cur.close()
                conn.close()
                return resp(400, {'error': 'Invalid JSON'})

            post_id = body.get('id')
            if not post_id:
                cur.close()
                conn.close()
                return resp(400, {'error': 'id обязателен'})

            photo_url = escape_sql(body.get('photo_url', ''))
            greeting = escape_sql(body.get('greeting', ''))
            description = escape_sql(body.get('description', ''))

            if not photo_url or not greeting or not description:
                cur.close()
                conn.close()
                return resp(400, {'error': 'photo_url, greeting и description обязательны'})

            post_id_safe = int(post_id)
            cur.execute(
                f"UPDATE {SCHEMA}.bot_daily_posts "
                f"SET photo_url = '{photo_url}', greeting = '{greeting}', description = '{description}' "
                f"WHERE id = {post_id_safe} "
                f"RETURNING id, photo_url, greeting, description, is_used, scheduled_date, created_at"
            )
            r = cur.fetchone()
            if not r:
                cur.close()
                conn.close()
                return resp(404, {'error': 'Пост не найден'})

            conn.commit()
            post = {
                'id': r[0],
                'photo_url': r[1] or '',
                'greeting': r[2] or '',
                'description': r[3] or '',
                'is_used': r[4],
                'scheduled_date': r[5].isoformat() if r[5] else None,
                'created_at': r[6].isoformat() if r[6] else None,
            }
            cur.close()
            conn.close()
            print(f"[ADMIN-BOT-POSTS] updated post id={post_id_safe}")
            return resp(200, {'ok': True, 'post': post})

        # ── DELETE — удалить пост ──
        if method == 'DELETE':
            qs = event.get('queryStringParameters') or {}
            post_id = qs.get('id')
            if not post_id:
                cur.close()
                conn.close()
                return resp(400, {'error': 'id обязателен (query string ?id=X)'})

            post_id_safe = int(post_id)
            cur.execute(
                f"DELETE FROM {SCHEMA}.bot_daily_posts WHERE id = {post_id_safe}"
            )
            deleted = cur.rowcount
            conn.commit()
            cur.close()
            conn.close()

            if deleted == 0:
                return resp(404, {'error': 'Пост не найден'})

            print(f"[ADMIN-BOT-POSTS] deleted post id={post_id_safe}")
            return resp(200, {'ok': True})

        # ── Неизвестный метод ──
        cur.close()
        conn.close()
        return resp(405, {'error': f'Method {method} not allowed'})

    except Exception as e:
        print(f"[ADMIN-BOT-POSTS] error: {e}")
        try:
            conn.rollback()
            cur.close()
            conn.close()
        except Exception:
            pass
        return resp(500, {'error': str(e)})