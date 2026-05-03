"""Автопубликация видео-сторис в канал @ug_transfer_pro раз в 48 часов. Запускается по расписанию."""
import os
import json
import uuid
import urllib.request
import urllib.error
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')
CHAT_ID = '@ug_transfer_pro'


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
            print(f"[cron postStory] HTTP {e.code}: {err_body}")
            return json.loads(err_body)
        except Exception:
            return {'ok': False, 'error': f'HTTP {e.code}'}
    except Exception as e:
        return {'ok': False, 'error': str(e)}


def post_story(video_url: str, caption: str) -> dict:
    try:
        with urllib.request.urlopen(video_url, timeout=30) as r:
            video_bytes = r.read()
    except Exception as e:
        return {'ok': False, 'error': f'download: {e}'}

    content = {'type': 'video', 'video': 'attach://video_file'}
    if caption:
        content['caption'] = caption

    fields = {
        'chat_id': CHAT_ID,
        'content': json.dumps(content),
        'active_period': '172800',
    }
    files = {'video_file': ('story.mp4', video_bytes, 'video/mp4')}
    return tg_api_multipart('postStory', fields, files)


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