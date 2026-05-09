"""Публикация сторис в канал @ug_transfer_pro через Telethon (user-аккаунт).
POST {video_url, caption?} — публикует сторис, возвращает {ok, story_id}.
v3: автообрезка через imageio-ffmpeg.
"""
import os
import json
import hashlib
import asyncio
import urllib.request
import tempfile
import subprocess
import shutil
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


def get_ffmpeg_path():
    """Возвращает путь к системному ffmpeg, если есть."""
    return shutil.which('ffmpeg')


def transcode_to_story(src_path: str) -> tuple:
    """Приводит видео к формату Telegram Stories: 720x1280 9:16, до 60с, H.264/AAC.
    Горизонтальное видео обрезается по центру (crop), длинное — режется до 60с.
    Возвращает (out_path, w, h, duration). Если ffmpeg недоступен — возвращает исходник.
    """
    ffmpeg_bin = get_ffmpeg_path()
    if not ffmpeg_bin:
        print("[transcode] ffmpeg не найден ни через imageio_ffmpeg, ни в PATH")
        return src_path, 0, 0, 0
    print(f"[transcode] using ffmpeg: {ffmpeg_bin}")

    out_path = src_path.replace('.mp4', '_story.mp4')
    if out_path == src_path:
        out_path = src_path + '_story.mp4'

    # scale=увеличиваем чтобы покрыть 720x1280, crop=обрезаем по центру до 720x1280
    vf = "scale='if(gt(a,9/16),-2,720)':'if(gt(a,9/16),1280,-2)',crop=720:1280"

    cmd = [
        ffmpeg_bin, '-y', '-i', src_path,
        '-t', '60',
        '-vf', vf,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-c:a', 'aac', '-b:a', '96k',
        '-r', '30',
        out_path,
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, timeout=120)
        if proc.returncode != 0:
            print(f"[transcode] ffmpeg failed: {proc.stderr.decode('utf-8', 'ignore')[-500:]}")
            return src_path, 0, 0, 0
        print(f"[transcode] ok: {os.path.getsize(out_path)} bytes")
        return out_path, 720, 1280, 0
    except Exception as e:
        print(f"[transcode] {e}")
        return src_path, 0, 0, 0


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
    out_path = None
    client = TelegramClient(StringSession(session_str), api_id, api_hash)
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as f:
            f.write(video_bytes)
            tmp_path = f.name

        # Читаем параметры исходника
        probe = probe_video(tmp_path)
        src_w = probe.get('w') or 0
        src_h = probe.get('h') or 0
        src_dur = probe.get('duration') or 0
        print(f"[post_story] src: w={src_w} h={src_h} dur={src_dur}s size={len(video_bytes)} ffmpeg={get_ffmpeg_path()}")

        # Если есть ffmpeg — обрезаем; иначе проверяем что видео уже подходит
        if get_ffmpeg_path():
            out_path, ow, oh, _ = transcode_to_story(tmp_path)
            upload_path = out_path
            final_probe = probe_video(upload_path) if out_path != tmp_path else probe
            real_w = final_probe.get('w') or ow or 720
            real_h = final_probe.get('h') or oh or 1280
            real_dur = final_probe.get('duration') or min(src_dur, 60) if src_dur else 0
        else:
            # ffmpeg недоступен — проверяем требования и отправляем как есть
            if src_w and src_h and src_w >= src_h:
                return {'ok': False, 'error': f'Видео горизонтальное ({src_w}x{src_h}). Telegram Stories требует вертикальное (9:16). Обрежь видео заранее или загрузи вертикальное.'}
            if src_dur and src_dur > 60:
                return {'ok': False, 'error': f'Видео {src_dur} сек — Telegram Stories принимает до 60 сек.'}
            upload_path = tmp_path
            real_w = src_w or 720
            real_h = src_h or 1280
            real_dur = src_dur or 0
        print(f"[post_story] upload: w={real_w} h={real_h} dur={real_dur}s file={upload_path}")

        upload_size = os.path.getsize(upload_path)
        if upload_size > 30 * 1024 * 1024:
            return {'ok': False, 'error': f'После обрезки видео {upload_size//1024//1024} МБ — лимит сторис 30 МБ.'}

        await client.connect()
        peer = await client.get_input_entity(CHANNEL)

        file = await client.upload_file(upload_path)
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
        if out_path and out_path != tmp_path and os.path.exists(out_path):
            os.unlink(out_path)


def handler(event: dict, context) -> dict:
    """Публикует сторис через user-аккаунт. Принимает video_url и caption."""
    print(f"[handler] v3 method={event.get('httpMethod')} path={event.get('path')}")
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {**CORS, 'Access-Control-Max-Age': '86400'}, 'body': ''}

    headers = event.get('headers') or {}
    token = headers.get('x-admin-token') or headers.get('X-Admin-Token') or ''
    if not verify_token(token):
        print(f"[handler] unauthorized, token len={len(token)}")
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