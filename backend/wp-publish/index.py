"""Публикация постов на WordPress-сайт ug-transfer.online."""
import os
import json
import hashlib
import base64
import urllib.request
from datetime import datetime

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
}

WP_URL = "https://ug-transfer.online/wp-json/wp/v2/posts"


def get_admin_token():
    login = os.environ.get('ADMIN_LOGIN', '')
    password = os.environ.get('ADMIN_PASSWORD', '')
    return hashlib.sha256(f"{login}:{password}:admin_secret_2026".encode()).hexdigest()


def wp_auth_header():
    username = os.environ.get('WP_USERNAME', '')
    app_password = os.environ.get('WP_APP_PASSWORD', '')
    creds = base64.b64encode(f"{username}:{app_password}".encode()).decode()
    return f"Basic {creds}"


def wp_publish(title: str, content: str, status: str = "publish"):
    """Публикует пост в WordPress."""
    payload = json.dumps({
        "title": title,
        "content": content,
        "status": status,
        "format": "standard",
    }).encode()

    req = urllib.request.Request(
        WP_URL,
        data=payload,
        headers={
            'Content-Type': 'application/json',
            'Authorization': wp_auth_header(),
        },
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read())
        return {'id': data.get('id'), 'link': data.get('link')}


def resp(status, body):
    return {'statusCode': status, 'headers': CORS, 'body': json.dumps(body, ensure_ascii=False)}


def handler(event: dict, context) -> dict:
    """Публикация поста на WordPress ug-transfer.online."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    token = (event.get('headers') or {}).get('X-Admin-Token', '')
    if token != get_admin_token():
        return resp(401, {'error': 'Unauthorized'})

    method = event.get('httpMethod', 'GET')

    if method == 'GET':
        return resp(200, {'ok': True, 'status': 'ready'})

    if method == 'POST':
        body = json.loads(event.get('body') or '{}')
        title = body.get('title', '').strip()
        content = body.get('content', '').strip()
        status = body.get('status', 'publish')

        if not title or not content:
            return resp(400, {'error': 'title и content обязательны'})

        result = wp_publish(title, content, status)
        return resp(200, {'ok': True, 'post_id': result['id'], 'link': result['link']})

    return resp(405, {'error': 'Method not allowed'})
