"""Автопубликация видео-сторис в канал @ug_transfer_pro раз в 48 часов. Использует user-аккаунт через Telethon."""
import os
import json
import hashlib
import urllib.request
import urllib.error
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')
USER_STORY_URL = 'https://functions.poehali.dev/e47b662c-3d9d-42c4-aa13-dda080f9a777'


def post_story(video_url: str, caption: str) -> dict:
    """Делегирует публикацию в tg-user-story (Telethon, user-аккаунт)."""
    admin_login = os.environ.get('ADMIN_LOGIN', '')
    admin_password = os.environ.get('ADMIN_PASSWORD', '')
    admin_token = hashlib.sha256(f"{admin_login}:{admin_password}:admin_secret_2026".encode()).hexdigest()
    payload = json.dumps({'video_url': video_url, 'caption': caption}).encode()
    req = urllib.request.Request(
        USER_STORY_URL,
        data=payload,
        headers={'Content-Type': 'application/json', 'X-Admin-Token': admin_token},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode())
        except Exception:
            return {'ok': False, 'error': f'HTTP {e.code}'}
    except Exception as e:
        return {'ok': False, 'error': str(e)}


def esc(s) -> str:
    return str(s or '').replace("'", "''")


def handler(event: dict, context) -> dict:
    """Берёт следующий неотправленный сторис, публикует, помечает is_used. Если все использованы — сбрасывает флаг (зацикленная очередь)."""
    dsn = os.environ['DATABASE_URL']
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()
    try:
        cur.execute(f"SELECT id, video_url, caption FROM {SCHEMA}.bot_stories WHERE is_used=FALSE ORDER BY id ASC LIMIT 1")
        row = cur.fetchone()
        if not row:
            cur.execute(f"UPDATE {SCHEMA}.bot_stories SET is_used=FALSE")
            conn.commit()
            cur.execute(f"SELECT id, video_url, caption FROM {SCHEMA}.bot_stories ORDER BY id ASC LIMIT 1")
            row = cur.fetchone()
        if not row:
            return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'ok': False, 'reason': 'no_stories'})}
        sid, video_url, caption = row
        result = post_story(video_url, caption or '')
        status = 'ok' if result.get('ok') else f"err:{result.get('error') or result.get('description', 'unknown')}"
        cur.execute(f"UPDATE {SCHEMA}.bot_stories SET is_used=TRUE, last_sent_at=NOW(), last_status='{esc(status)}' WHERE id={sid}")
        conn.commit()
        return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'ok': result.get('ok', False), 'id': sid, 'status': status})}
    finally:
        cur.close()
        conn.close()