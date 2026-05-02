"""Ежедневная рассылка контактов ЮГ ТРАНСФЕР в Telegram и ВКонтакте."""
import os
import json
import re
import urllib.request
import urllib.parse
from datetime import date
import psycopg2

CHANNEL_ID = '@ug_transfer_pro'
SCHEMA = os.environ.get('MAIN_DB_SCHEMA') or 't_p67171637_yug_transfer_prize_l'
VK_API_VERSION = '5.199'

CONTACTS = """
━━━━━━━━━━━━━━━━━━━
✨ <b>ПОЧЕМУ ВЫБИРАЮТ НАС:</b>

✅ Подача авто за 5 минут
✅ Фиксированная цена без накруток
✅ Опытные водители со стажем
✅ Иномарки бизнес и комфорт класса
✅ Круглосуточно — 24/7 без выходных
✅ Детские кресла по запросу
✅ Безналичная оплата и чеки

━━━━━━━━━━━━━━━━━━━
📲 <b>СВЯЖИТЕСЬ УДОБНЫМ СПОСОБОМ:</b>

📞 <b>Телефон:</b> +7 (995) 614-14-14
💬 <b>WhatsApp:</b> wa.me/79956141414
✈️ <b>Telegram:</b> @ug_transfer_online
🌐 <b>Сайт:</b> ug-transfer.online
🤖 <b>Бот заказа:</b> @ug_sait_bot

━━━━━━━━━━━━━━━━━━━
🚖 <i>ЮГ ТРАНСФЕР — ваш надёжный партнёр в дороге!</i>

#такси #трансфер #ЮгТрансфер #поездки"""


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


def strip_html(html_text: str) -> str:
    text = re.sub(r'<[^>]+>', '', html_text or '')
    text = text.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"')
    return text.strip()


def vk_api(method, params):
    token = os.environ.get('VK_ACCESS_TOKEN', '')
    if not token:
        return {}
    params = {**params, 'access_token': token, 'v': VK_API_VERSION}
    url = f"https://api.vk.com/method/{method}"
    data = urllib.parse.urlencode(params).encode()
    req = urllib.request.Request(url, data=data, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except Exception:
        return {}


def vk_upload_photo(photo_url: str, group_id: str, log: list):
    try:
        with urllib.request.urlopen(photo_url, timeout=15) as resp:
            photo_bytes = resp.read()
            content_type = resp.headers.get('Content-Type', 'image/jpeg')
        log.append({'step': 'download', 'ok': True, 'size': len(photo_bytes), 'ct': content_type})
    except Exception as e:
        log.append({'step': 'download', 'ok': False, 'err': str(e)})
        return None

    server = vk_api('photos.getWallUploadServer', {'group_id': group_id})
    log.append({'step': 'getWallUploadServer', 'resp': server})
    upload_url = server.get('response', {}).get('upload_url')
    if not upload_url:
        return None

    boundary = '----vkBoundary7MA4YWxkTrZu0gW'
    ext = 'jpg'
    if 'png' in content_type:
        ext = 'png'
    elif 'webp' in content_type:
        ext = 'webp'

    body = (
        f'--{boundary}\r\n'
        f'Content-Disposition: form-data; name="photo"; filename="photo.{ext}"\r\n'
        f'Content-Type: {content_type}\r\n\r\n'
    ).encode() + photo_bytes + f'\r\n--{boundary}--\r\n'.encode()

    req = urllib.request.Request(upload_url, data=body, headers={
        'Content-Type': f'multipart/form-data; boundary={boundary}'
    }, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            uploaded = json.loads(resp.read())
        log.append({'step': 'upload', 'resp': uploaded})
    except Exception as e:
        log.append({'step': 'upload', 'ok': False, 'err': str(e)})
        return None

    saved = vk_api('photos.saveWallPhoto', {
        'group_id': group_id,
        'photo': uploaded.get('photo', ''),
        'server': uploaded.get('server', ''),
        'hash': uploaded.get('hash', ''),
    })
    log.append({'step': 'saveWallPhoto', 'resp': saved})
    items = saved.get('response', [])
    if not items:
        return None
    item = items[0]
    return f"photo{item['owner_id']}_{item['id']}"


def post_to_vk(photo_url: str, text: str, debug: bool = False):
    group_id = os.environ.get('VK_GROUP_ID', '')
    if not group_id or not os.environ.get('VK_ACCESS_TOKEN'):
        return {'ok': False, 'error': 'no_vk_credentials'}

    log = []
    attachment = vk_upload_photo(photo_url, group_id, log) if photo_url else None
    params = {
        'owner_id': f'-{group_id}',
        'from_group': 1,
        'message': text,
    }
    if attachment:
        params['attachments'] = attachment

    result = vk_api('wall.post', params)
    out = {}
    if 'response' in result:
        out = {'ok': True, 'post_id': result['response'].get('post_id'), 'attachment': attachment}
    else:
        out = {'ok': False, 'error': result.get('error', {}).get('error_msg', 'unknown'), 'attachment': attachment}
    if debug:
        out['log'] = log
    return out


def get_next_post():
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    today = date.today().isoformat()
    cur.execute(
        f"SELECT id, photo_url, greeting, description FROM {SCHEMA}.bot_daily_posts "
        f"WHERE scheduled_date IS NULL OR scheduled_date < '{today}' "
        f"ORDER BY scheduled_date ASC NULLS FIRST, id ASC LIMIT 1"
    )
    row = cur.fetchone()
    if row:
        cur.execute(
            f"UPDATE {SCHEMA}.bot_daily_posts SET is_used = TRUE, scheduled_date = '{today}' "
            f"WHERE id = {row[0]}"
        )
        conn.commit()
    cur.close()
    conn.close()
    return row


def handler(event: dict, context) -> dict:
    """Ежедневный пост: отправка в Telegram @ug_transfer_pro и ВКонтакте."""
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    qs = event.get('queryStringParameters') or {}
    if qs.get('debug') == 'vkphoto':
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(f"SELECT photo_url, greeting, description FROM {SCHEMA}.bot_daily_posts ORDER BY id ASC LIMIT 1")
        r = cur.fetchone()
        cur.close()
        conn.close()
        if not r:
            return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'err': 'no posts'})}
        photo, greeting, description = r
        text = strip_html(f"{greeting}\n\n{description}\n{CONTACTS}")
        vk_result = post_to_vk(photo, text, debug=True)
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'vk': vk_result, 'photo_url': photo}, ensure_ascii=False)}

    row = get_next_post()
    if not row:
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'ok': False, 'error': 'no posts'})}

    post_id, photo, greeting, description = row
    tg_text = f"<b>{greeting}</b>\n\n{description}\n{CONTACTS}"
    vk_text = strip_html(f"{greeting}\n\n{description}\n{CONTACTS}")

    tg_result = tg_api('sendPhoto', {
        'chat_id': CHANNEL_ID,
        'photo': photo,
        'caption': tg_text,
        'parse_mode': 'HTML',
    })

    vk_result = post_to_vk(photo, vk_text)

    return {
        'statusCode': 200,
        'headers': cors,
        'body': json.dumps({
            'ok': tg_result.get('ok', False),
            'post_id': post_id,
            'tg': tg_result.get('ok', False),
            'vk': vk_result,
        }),
    }