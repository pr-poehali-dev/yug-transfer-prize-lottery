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


def probe_video(path: str) -> dict:
    """Читаем реальные параметры видео (w, h, duration_sec) через hachoir."""
    try:
        from hachoir.parser import createParser
        from hachoir.metadata import extractMetadata
        parser = createParser(path)
        if not parser:
            return {}
        with parser:
            meta = extractMetadata(parser)
        if not meta:
            return {}
        w = h = 0
        dur = 0
        try:
            w = int(meta.get('width'))
        except Exception:
            pass
        try:
            h = int(meta.get('height'))
        except Exception:
            pass
        try:
            d = meta.get('duration')
            dur = int(d.total_seconds()) if hasattr(d, 'total_seconds') else int(d)
        except Exception:
            pass
        return {'w': w, 'h': h, 'duration': dur}
    except Exception as e:
        print(f"[probe_video] {e}")
        return {}


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

    # Telegram Stories: до 30 МБ
    if len(video_bytes) > 30 * 1024 * 1024:
        return {'ok': False, 'error': f'Видео слишком большое: {len(video_bytes)//1024//1024} МБ. Telegram лимит для сторис — 30 МБ.'}

    tmp_path = None
    client = TelegramClient(StringSession(session_str), api_id, api_hash)
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as f:
            f.write(video_bytes)
            tmp_path = f.name

        # Читаем реальные параметры файла
        probe = probe_video(tmp_path)
        real_w = probe.get('w') or 720
        real_h = probe.get('h') or 1280
        real_dur = probe.get('duration') or 0
        print(f"[post_story] probe: w={real_w} h={real_h} dur={real_dur}s size={len(video_bytes)}")

        # Проверка: Telegram Stories требует вертикальное видео
        if real_w and real_h and real_w >= real_h:
            return {'ok': False, 'error': f'Видео горизонтальное ({real_w}x{real_h}). Telegram Stories принимает только вертикальные (9:16, например 720x1280).'}
        if real_dur and real_dur > 60:
            return {'ok': False, 'error': f'Видео {real_dur} сек — Telegram Stories принимает до 60 сек.'}

        await client.connect()
        peer = await client.get_input_entity(CHANNEL)

        file = await client.upload_file(tmp_path)
        media = InputMediaUploadedDocument(
            file=file,
            mime_type='video/mp4',
            attributes=[DocumentAttributeVideo(
                duration=real_dur or 0,
                w=real_w,
                h=real_h,
                supports_streaming=True,
            )],
        )

        result = await client(SendStoryRequest(
            peer=peer,
            media=media,
            privacy_rules=[InputPrivacyValueAllowAll()],
            caption=caption or None,
            period=172800,
        ))
        return {'ok': True, 'result': str(result)[:500], 'probe': probe}
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