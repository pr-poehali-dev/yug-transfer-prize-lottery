"""
Загрузка видео-кружка в S3.
Принимает base64-encoded видео, сохраняет в S3, возвращает CDN URL.
Выделена в отдельную функцию для поддержки файлов до 8 МБ.
"""
import os
import json
import base64
import uuid
import boto3

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
}

ADMIN_TOKEN_HASH = None

def _check_auth(headers: dict) -> bool:
    import hashlib
    token = headers.get('x-admin-token') or headers.get('X-Admin-Token', '')
    password = os.environ.get('ADMIN_PASSWORD', '')
    expected = hashlib.sha256(password.encode()).hexdigest()
    return token == expected or token == password

def handler(event: dict, context) -> dict:
    """Загружает видео-кружок в S3 и возвращает CDN URL."""

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    headers = {k.lower(): v for k, v in (event.get('headers') or {}).items()}

    if not _check_auth(headers):
        return {'statusCode': 403, 'headers': CORS, 'body': json.dumps({'error': 'Forbidden'})}

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
    print(f"[UPLOAD-VIDEO] size: {size_mb:.1f} MB")

    if size_mb > 8:
        return {'statusCode': 413, 'headers': CORS, 'body': json.dumps({'error': f'Файл слишком большой: {size_mb:.1f} МБ. Максимум 8 МБ'})}

    filename = body.get('filename', 'video.mp4')
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else 'mp4'
    key = f"posts/video_{uuid.uuid4()}.{ext}"

    s3 = boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    )
    s3.put_object(Bucket='files', Key=key, Body=video_bytes, ContentType='video/mp4')
    cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
    print(f"[UPLOAD-VIDEO] uploaded: {cdn_url}")

    return {
        'statusCode': 200,
        'headers': CORS,
        'body': json.dumps({'ok': True, 'url': cdn_url}),
    }
