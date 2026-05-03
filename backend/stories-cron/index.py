"""Автопубликация видео-сторис в канал @ug_transfer_pro раз в 48 часов. Запускается по расписанию."""
import os
import json
import urllib.request
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')


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
    business_id = os.environ.get('TELEGRAM_BUSINESS_CONNECTION_ID', '').strip()
    if not business_id:
        return {'ok': False, 'error': 'no_business_connection'}
    payload = {
        'business_connection_id': business_id,
        'content': {'type': 'video', 'video': video_url},
        'active_period': 172800,
    }
    if caption:
        payload['caption'] = caption
    return tg_api('postStory', payload)


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
