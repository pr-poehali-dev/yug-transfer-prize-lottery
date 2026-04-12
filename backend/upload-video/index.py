"""
Загрузка видео-кружка в S3 через чанки.
POST ?action=init              — начать загрузку, получить upload_id
POST ?action=chunk&id=...&n=N — загрузить N-й чанк (base64)
POST ?action=complete&id=...  — собрать все чанки, залить в S3
POST ?action=cancel&id=...    — отменить загрузку
"""
import os
import json
import base64
import uuid
import boto3
from botocore.config import Config

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
}

CHUNK_PREFIX = "uploads/chunks"


def _check_auth(headers: dict) -> bool:
    import hashlib
    token = headers.get('x-admin-token') or headers.get('X-Admin-Token', '')
    admin_login = os.environ.get('ADMIN_LOGIN', '')
    admin_password = os.environ.get('ADMIN_PASSWORD', '')
    token_base = f"{admin_login}:{admin_password}:admin_secret_2026"
    expected = hashlib.sha256(token_base.encode()).hexdigest()
    return token == expected


def _s3():
    return boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
        config=Config(signature_version='s3v4'),
    )


def handler(event: dict, context) -> dict:
    """Чанковая загрузка видео: init → chunk×N → complete."""

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    headers = {k.lower(): v for k, v in (event.get('headers') or {}).items()}
    if not _check_auth(headers):
        return {'statusCode': 403, 'headers': CORS, 'body': json.dumps({'error': 'Forbidden'})}

    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')
    body = json.loads(event.get('body') or '{}')

    s3 = _s3()

    # ── INIT: начать новую загрузку ────────────────────────────────────────────
    if action == 'init':
        upload_id = str(uuid.uuid4())
        filename = body.get('filename', 'video.mp4')
        ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else 'mp4'
        final_key = f"posts/video_{upload_id}.{ext}"
        meta = json.dumps({'final_key': final_key, 'total_chunks': body.get('total_chunks', 0)})
        s3.put_object(Bucket='files', Key=f"{CHUNK_PREFIX}/{upload_id}/meta.json",
                      Body=meta.encode(), ContentType='application/json')
        print(f"[UPLOAD-VIDEO] init upload_id={upload_id} key={final_key}")
        return {'statusCode': 200, 'headers': CORS,
                'body': json.dumps({'ok': True, 'upload_id': upload_id})}

    # ── CHUNK: загрузить один чанк ─────────────────────────────────────────────
    if action == 'chunk':
        upload_id = params.get('id', '')
        chunk_n = int(params.get('n', 0))
        data_b64 = body.get('data', '')
        if not upload_id or not data_b64:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'missing id or data'})}

        chunk_bytes = base64.b64decode(data_b64)
        s3.put_object(Bucket='files',
                      Key=f"{CHUNK_PREFIX}/{upload_id}/chunk_{chunk_n:04d}",
                      Body=chunk_bytes, ContentType='application/octet-stream')
        print(f"[UPLOAD-VIDEO] chunk {chunk_n} for {upload_id}, size={len(chunk_bytes)}")
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

    # ── COMPLETE: собрать чанки и сохранить финальный файл ────────────────────
    if action == 'complete':
        upload_id = params.get('id', '')
        if not upload_id:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'missing id'})}

        meta_obj = s3.get_object(Bucket='files', Key=f"{CHUNK_PREFIX}/{upload_id}/meta.json")
        meta = json.loads(meta_obj['Body'].read())
        final_key = meta['final_key']
        total_chunks = int(meta.get('total_chunks', 0))

        if total_chunks == 0:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'нет чанков в мета'})}

        print(f"[UPLOAD-VIDEO] assembling {total_chunks} chunks for {upload_id}")

        # Читаем чанки напрямую по номерам — без list_objects (eventual consistency)
        parts = []
        for n in range(total_chunks):
            key = f"{CHUNK_PREFIX}/{upload_id}/chunk_{n:04d}"
            obj = s3.get_object(Bucket='files', Key=key)
            parts.append(obj['Body'].read())
            print(f"[UPLOAD-VIDEO] read chunk {n}, size={len(parts[-1])}")

        video_bytes = b''.join(parts)
        size_mb = len(video_bytes) / 1024 / 1024
        print(f"[UPLOAD-VIDEO] total size: {size_mb:.1f} MB")

        if size_mb > 150:
            return {'statusCode': 413, 'headers': CORS,
                    'body': json.dumps({'error': f'Файл слишком большой: {size_mb:.1f} МБ. Максимум 150 МБ'})}

        s3.put_object(Bucket='files', Key=final_key, Body=video_bytes, ContentType='video/mp4')
        cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{final_key}"

        for n in range(total_chunks):
            s3.delete_object(Bucket='files', Key=f"{CHUNK_PREFIX}/{upload_id}/chunk_{n:04d}")
        s3.delete_object(Bucket='files', Key=f"{CHUNK_PREFIX}/{upload_id}/meta.json")

        print(f"[UPLOAD-VIDEO] done: {cdn_url}")
        return {'statusCode': 200, 'headers': CORS,
                'body': json.dumps({'ok': True, 'url': cdn_url})}

    # ── CANCEL ─────────────────────────────────────────────────────────────────
    if action == 'cancel':
        upload_id = params.get('id', '')
        if upload_id:
            resp = s3.list_objects_v2(Bucket='files', Prefix=f"{CHUNK_PREFIX}/{upload_id}/")
            for obj in resp.get('Contents', []):
                s3.delete_object(Bucket='files', Key=obj['Key'])
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

    return {'statusCode': 400, 'headers': CORS,
            'body': json.dumps({'error': f'unknown action: {action}'})}