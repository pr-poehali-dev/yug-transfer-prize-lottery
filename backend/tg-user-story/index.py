"""Публикация сторис в канал @ug_transfer_pro через Telethon (user-аккаунт).
POST {video_url, caption?} — публикует сторис, возвращает {ok, story_id}.
"""
import os
import json
import hashlib
import asyncio
import urllib.request
import tempfile
import psycopg2

from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.tl.functions.stories import SendStoryRequest
from telethon.tl.types import InputMediaUploadedDocument, InputPrivacyValueAllowAll, DocumentAttributeVideo

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
}
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')
CHANNEL = '@ug_transfer_pro'


def verify_token(token: str) -> bool:
    admin_login = os.environ.get('ADMIN_LOGIN', '')
    admin_password = os.environ.get('ADMIN_PASSWORD', '')
    base = f"{admin_login}:{admin_password}:admin_secret_2026"
    return token == hashlib.sha256(base.encode()).hexdigest()


def resp(status: int, body: dict) -> dict:
    return {'statusCode': status, 'headers': CORS, 'body': json.dumps(body, default=str)}


def get_session() -> str:
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    cur.execute(f"SELECT session_string FROM {SCHEMA}.tg_user_session WHERE id=1 AND logged_in=TRUE")
    r = cur.fetchone()
    cur.close(); conn.close()
    return r[0] if r else ''


async def post_story(video_url: str, caption: str) -> dict:
    session_str = get_session()
    if not session_str:
        return {'ok': False, 'error': 'Не залогинен. Сначала войди через TG User Auth.'}

    api_id = int(os.environ['TG_API_ID'])
    api_hash = os.environ['TG_API_HASH']

    try:
        with urllib.request.urlopen(video_url, timeout=60) as r:
            video_bytes = r.read()
    except Exception as e:
        return {'ok': False, 'error': f'download: {e}'}

    tmp_path = None
    client = TelegramClient(StringSession(session_str), api_id, api_hash)
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as f:
            f.write(video_bytes)
            tmp_path = f.name

        await client.connect()
        peer = await client.get_input_entity(CHANNEL)

        file = await client.upload_file(tmp_path)
        media = InputMediaUploadedDocument(
            file=file,
            mime_type='video/mp4',
            attributes=[DocumentAttributeVideo(duration=0, w=720, h=1280, supports_streaming=True)],
        )

        result = await client(SendStoryRequest(
            peer=peer,
            media=media,
            privacy_rules=[InputPrivacyValueAllowAll()],
            caption=caption or None,
            period=172800,
        ))
        return {'ok': True, 'result': str(result)[:500]}
    except Exception as e:
        return {'ok': False, 'error': str(e)}
    finally:
        try:
            await client.disconnect()
        except Exception:
            pass
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


def handler(event: dict, context) -> dict:
    """Публикует сторис через user-аккаунт. Принимает video_url и caption."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {**CORS, 'Access-Control-Max-Age': '86400'}, 'body': ''}

    headers = event.get('headers') or {}
    token = headers.get('x-admin-token') or headers.get('X-Admin-Token') or ''
    if not verify_token(token):
        return resp(401, {'error': 'unauthorized'})

    body = json.loads(event.get('body') or '{}')
    video_url = body.get('video_url', '').strip()
    caption = body.get('caption', '').strip()
    if not video_url:
        return resp(400, {'error': 'video_url required'})

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(post_story(video_url, caption))
        return resp(200, result)
    finally:
        loop.close()
