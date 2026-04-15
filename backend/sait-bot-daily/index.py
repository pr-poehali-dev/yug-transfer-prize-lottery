"""Ежедневная рассылка контактов ЮГ ТРАНСФЕР в Telegram + автопубликация в WordPress."""
import os
import json
import base64
import urllib.request
from datetime import date
import psycopg2

CHANNEL_ID = '@ug_transfer_pro'
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')
WP_URL = "https://ug-transfer.online/wp-json/wp/v2/posts"

CONTACTS = """
<b>Свяжитесь с нами удобным способом:</b>

📞 Телефон: +7 (995) 614-14-14
💬 WhatsApp: wa.me/79956141414
✈️ Telegram: @ug_transfer_online
🌐 Онлайн: ug-transfer.online
🤖 Бот для заказа: @ug_sait_bot"""

CONTACTS_WP = """<strong>Свяжитесь с нами удобным способом:</strong>

📞 <a href="tel:+79956141414">+7 (995) 614-14-14</a>
💬 <a href="https://wa.me/79956141414">WhatsApp</a>
✈️ <a href="https://t.me/ug_transfer_online">Telegram</a>
🌐 <a href="https://ug-transfer.online">Заказать онлайн</a>

<em>UG Transfer — ваш надёжный попутчик по всей России.</em>"""


def get_bot_token():
    return os.environ.get('TELEGRAM_BOT_TOKEN_2', '')


def tg_api(method, payload):
    url = f"https://api.telegram.org/bot{get_bot_token()}/{method}"
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except Exception:
        return {}


def wp_publish(greeting: str, description: str, photo_url: str):
    """Публикует пост в WordPress."""
    username = os.environ.get('WP_USERNAME', '')
    app_password = os.environ.get('WP_APP_PASSWORD', '')
    if not username or not app_password:
        return None

    today = date.today().strftime("%d.%m.%Y")
    title = f"{greeting} | {today}"

    img_html = f'<img src="{photo_url}" alt="{greeting}" style="max-width:100%;border-radius:12px;margin-bottom:16px;" />' if photo_url else ''
    content = f"""{img_html}

<p>{description}</p>

{CONTACTS_WP}"""

    creds = base64.b64encode(f"{username}:{app_password}".encode()).decode()
    payload = json.dumps({
        "title": title,
        "content": content,
        "status": "publish",
        "format": "standard",
    }).encode()

    req = urllib.request.Request(
        WP_URL,
        data=payload,
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Basic {creds}',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
            return {'id': data.get('id'), 'link': data.get('link')}
    except Exception as e:
        print(f"[WP publish] ERROR: {e}")
        return None


def get_next_post():
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    today = date.today().isoformat()
    cur.execute(f"SELECT id, photo_url, greeting, description FROM {SCHEMA}.bot_daily_posts WHERE scheduled_date = '{today}' AND is_used = FALSE LIMIT 1")
    row = cur.fetchone()
    if not row:
        cur.execute(f"SELECT id, photo_url, greeting, description FROM {SCHEMA}.bot_daily_posts WHERE is_used = FALSE AND scheduled_date IS NULL ORDER BY id ASC LIMIT 1")
        row = cur.fetchone()
    if not row:
        cur.execute(f"UPDATE {SCHEMA}.bot_daily_posts SET is_used = FALSE")
        conn.commit()
        cur.execute(f"SELECT id, photo_url, greeting, description FROM {SCHEMA}.bot_daily_posts WHERE is_used = FALSE ORDER BY id ASC LIMIT 1")
        row = cur.fetchone()
    if row:
        cur.execute(f"UPDATE {SCHEMA}.bot_daily_posts SET is_used = TRUE, scheduled_date = '{today}' WHERE id = {row[0]}")
        conn.commit()
    cur.close()
    conn.close()
    return row


def handler(event: dict, context) -> dict:
    """Ежедневный пост: отправка в Telegram @ug_transfer_pro + публикация на WordPress ug-transfer.online."""
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    row = get_next_post()
    if not row:
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'ok': False, 'error': 'no posts'})}

    post_id, photo, greeting, description = row
    text = f"{greeting}\n\n{description}\n{CONTACTS}"

    tg_result = tg_api('sendPhoto', {
        'chat_id': CHANNEL_ID,
        'photo': photo,
        'caption': text,
        'parse_mode': 'HTML',
    })

    wp_result = wp_publish(greeting, description, photo)

    return {
        'statusCode': 200,
        'headers': cors,
        'body': json.dumps({
            'ok': tg_result.get('ok', False),
            'post_id': post_id,
            'wp': wp_result,
        }),
    }
