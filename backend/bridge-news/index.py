"""
Новости Крымского моста: читает публичный Telegram-канал @most_official
через веб-версию t.me/s/ и возвращает последние посты для блока новостей на сайте.
GET — последние посты (текст, фото, дата, ссылка на оригинал).
"""
import json
import re
import html
import urllib.request
from datetime import datetime

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

CHANNEL = 'most_official'
LIMIT = 5


def fetch_html(channel: str) -> str:
    url = f'https://t.me/s/{channel}'
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept-Language': 'ru,en;q=0.9',
    })
    with urllib.request.urlopen(req, timeout=25) as resp:
        return resp.read().decode('utf-8', errors='ignore')


def clean_text(raw: str) -> str:
    text = re.sub(r'<br\s*/?>', '\n', raw, flags=re.I)
    text = re.sub(r'</p>', '\n', text, flags=re.I)
    text = re.sub(r'<[^>]+>', '', text)
    text = html.unescape(text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def parse_posts(page: str):
    posts = []
    blocks = re.split(r'<div class="tgme_widget_message[ "]', page)[1:]
    for block in blocks:
        post_id = None
        m_id = re.search(r'data-post="[^"]+/(\d+)"', block)
        if m_id:
            post_id = m_id.group(1)

        text = ''
        m_text = re.search(
            r'<div class="tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>\s*(?:<div class="tgme_widget_message_footer|<div class="tgme_widget_message_reply|<a class="tgme_widget_message_date)',
            block, re.S)
        if not m_text:
            m_text = re.search(r'<div class="tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>', block, re.S)
        if m_text:
            text = clean_text(m_text.group(1))

        image = None
        m_img = re.search(r"tgme_widget_message_photo_wrap[^>]*style=\"[^\"]*background-image:url\('([^']+)'\)", block)
        if m_img:
            image = html.unescape(m_img.group(1))

        date = None
        m_date = re.search(r'<time[^>]*datetime="([^"]+)"', block)
        if m_date:
            date = m_date.group(1)

        if not text and not image:
            continue

        link = f'https://t.me/{CHANNEL}/{post_id}' if post_id else f'https://t.me/{CHANNEL}'
        posts.append({
            'id': post_id or '',
            'text': text,
            'image': image,
            'date': date,
            'link': link,
        })

    return posts[-LIMIT:][::-1]


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    try:
        page = fetch_html(CHANNEL)
        posts = parse_posts(page)
    except Exception as e:
        return {
            'statusCode': 200,
            'headers': {**CORS, 'Content-Type': 'application/json'},
            'body': json.dumps({'posts': [], 'error': str(e), 'channel': CHANNEL}, ensure_ascii=False),
        }

    return {
        'statusCode': 200,
        'headers': {**CORS, 'Content-Type': 'application/json'},
        'body': json.dumps({'posts': posts, 'channel': CHANNEL}, ensure_ascii=False),
    }
