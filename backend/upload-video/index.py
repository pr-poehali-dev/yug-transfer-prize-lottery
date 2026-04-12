"""
Загрузка видео-кружка в S3.
GET ?action=presign&filename=... — выдаёт presigned PUT URL для прямой загрузки
POST (legacy base64) — оставлен для совместимости с мелкими файлами
"""
import os
import json
import base64
import uuid
import boto3
from botocore.config import Config

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
}


def _check_auth(headers: dict) -> bool:
    import hashlib
    token = headers.get('x-admin-token') or headers.get('X-Admin-Token', '')
    password = os.environ.get('ADMIN_PASSWORD', '')
    expected = hashlib.sha256(password.encode()).hexdigest()
    return token == expected or token == password


def _s3_client():
    return boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
        config=Config(signature_version='s3v4'),
    )


def handler(event: dict, context) -> dict:
    """Генерирует presigned PUT URL для прямой загрузки видео в S3."""

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    headers = {k.lower(): v for k, v in (event.get('headers') or {}).items()}

    if not _check_auth(headers):
        return {'statusCode': 403, 'headers': CORS, 'body': json.dumps({'error': 'Forbidden'})}

    method = event.get('httpMethod', 'POST')
    params = event.get('queryStringParameters') or {}

    # ── GET: выдать presigned PUT URL ──────────────────────────────────────────
    if method == 'GET' or params.get('action') == 'presign':
        filename = params.get('filename', 'video.mp4')
        ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else 'mp4'
        key = f"posts/video_{uuid.uuid4()}.{ext}"
        cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"

        s3 = _s3_client()
        presigned_url = s3.generate_presigned_url(
            'put_object',
            Params={'Bucket': 'files', 'Key': key, 'ContentType': 'video/mp4'},
            ExpiresIn=300,
        )
        print(f"[UPLOAD-VIDEO] presigned for key: {key}")
        return {
            'statusCode': 200,
            'headers': CORS,
            'body': json.dumps({'ok': True, 'upload_url': presigned_url, 'cdn_url': cdn_url}),
        }

    # ── POST: legacy base64 (только маленькие файлы) ───────────────────────────
    body = json.loads(event.get('body') or '{}')
    data_url = body.get('video', '')

    if not data_url:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'video обязателен'})}

    if ',' in data_url:
        _, encoded = data_url.split(',', 1)
    else:
        encoded = data_url

    video_bytes = base64.b64decode(encoded)
    size_mb = len(video_bytes) / 1024 / 1024
    print(f"[UPLOAD-VIDEO] base64 size: {size_mb:.1f} MB")

    if size_mb > 4:
        return {'statusCode': 413, 'headers': CORS, 'body': json.dumps({'error': 'Используйте presigned URL для файлов больше 4 МБ'})}

    filename = body.get('filename', 'video.mp4')
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else 'mp4'
    key = f"posts/video_{uuid.uuid4()}.{ext}"

    s3 = _s3_client()
    s3.put_object(Bucket='files', Key=key, Body=video_bytes, ContentType='video/mp4')
    cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
    print(f"[UPLOAD-VIDEO] uploaded base64: {cdn_url}")

    return {
        'statusCode': 200,
        'headers': CORS,
        'body': json.dumps({'ok': True, 'url': cdn_url}),
    }
