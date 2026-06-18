"""
Новости Крымского моста: читает публичный Telegram-канал @most_official
через веб-версию t.me/s/ и возвращает последние посты для блока новостей на сайте.
GET — последние посты (текст, фото, дата, ссылка на оригинал).
"""
import os
import json
import re
import html
import urllib.request
import psycopg2
from datetime import datetime, timezone

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

CHANNEL = 'most_official'
LIMIT = 5
CACHE_TTL = 60  # секунд: не чаще раза в минуту дёргаем Telegram
SCHEMA = os.environ.get('MAIN_DB_SCHEMA') or 't_p67171637_yug_transfer_prize_l'
CACHE_TABLE = f'{SCHEMA}.bridge_news_cache'


def db_connect():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def read_cache():
    """Возвращает (payload_str, age_seconds) или (None, None)."""
    try:
        conn = db_connect()
        cur = conn.cursor()
        cur.execute("SELECT payload, EXTRACT(EPOCH FROM (now() - updated_at)) FROM " + CACHE_TABLE + " WHERE id = 1")
        row = cur.fetchone()
        cur.close()
        conn.close()
        if row:
            return row[0], float(row[1])
    except Exception:
        pass
    return None, None


def write_cache(payload_str):
    try:
        conn = db_connect()
        cur = conn.cursor()
        safe = payload_str.replace("'", "''")
        cur.execute(
            "INSERT INTO " + CACHE_TABLE + " (id, payload, updated_at) VALUES (1, '" + safe + "', now()) "
            "ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()"
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception:
        pass


def fetch_html(channel: str) -> str:
    url = f'https://t.me/s/{channel}'
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept-Language': 'ru,en;q=0.9',
    }
    last_err = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=12) as resp:
                return resp.read().decode('utf-8', errors='ignore')
        except Exception as e:
            last_err = e
    raise last_err


def clean_text(raw: str) -> str:
    text = re.sub(r'<br\s*/?>', '\n', raw, flags=re.I)
    text = re.sub(r'</p>', '\n', text, flags=re.I)
    text = re.sub(r'<[^>]+>', '', text)
    text = html.unescape(text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def strip_promo(text: str) -> str:
    if not text:
        return text
    lines = text.split('\n')
    kept = []
    for line in lines:
        low = line.lower()
        if 'без задержек' in low or 'подписывайтесь' in low or 'официальный канал в max' in low or 'оперативная информация»' in low:
            continue
        if 't.me/' in low or 'http://' in low or 'https://' in low:
            continue
        kept.append(line)
    result = '\n'.join(kept)
    result = re.sub(r'\n{3,}', '\n\n', result)
    result = result.strip()
    result = re.sub(r'^\d{1,2}:\d{2}\s*', '', result).strip()
    return result


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
            text = strip_promo(clean_text(m_text.group(1)))

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


def json_response(body_str):
    return {
        'statusCode': 200,
        'headers': {**CORS, 'Content-Type': 'application/json'},
        'body': body_str,
    }


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    cached, age = read_cache()

    # Кэш свежий — отдаём готовое, Telegram не трогаем.
    if cached is not None and age is not None and age < CACHE_TTL:
        return json_response(cached)

    # Кэш устарел или пуст — обновляем из Telegram.
    try:
        page = fetch_html(CHANNEL)
        posts = parse_posts(page)
        payload = json.dumps({'posts': posts, 'channel': CHANNEL}, ensure_ascii=False)
        write_cache(payload)
        return json_response(payload)
    except Exception as e:
        # Telegram недоступен — отдаём старый кэш, если он есть.
        if cached is not None:
            return json_response(cached)
        return json_response(json.dumps({'posts': [], 'error': str(e), 'channel': CHANNEL}, ensure_ascii=False))