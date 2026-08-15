"""Ежедневная рассылка контактов ЮГ ТРАНСФЕР в Telegram и ВКонтакте."""
import os
import json
import re
import time
import urllib.request
import urllib.parse
import urllib.error
import ssl
import uuid
import http.client
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


TG_HOSTS = ['149.154.167.220', '149.154.167.99', '91.108.56.130', 'api.telegram.org']


def tg_api(method, payload):
    """Запрос к Telegram: из облака обычный адрес часто в таймауте, перебираем рабочие."""
    token = get_bot_token()
    if not token:
        return {'ok': False, 'description': 'TELEGRAM_BOT_TOKEN_2 пустой'}
    data = json.dumps(payload).encode()
    last_err = 'fail'
    for host in TG_HOSTS:
        ctx = ssl.create_default_context()
        if host != 'api.telegram.org':
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
        conn = http.client.HTTPSConnection(host, 443, timeout=20, context=ctx)
        try:
            conn.request('POST', f'/bot{token}/{method}', body=data,
                         headers={'Content-Type': 'application/json', 'Host': 'api.telegram.org'})
            return json.loads(conn.getresponse().read())
        except Exception as e:
            last_err = f"{type(e).__name__}: {str(e)[:200]}"
            print(f'[DAILY] tg {method} via {host} failed: {last_err}')
        finally:
            conn.close()
    return {'ok': False, 'description': last_err}


def tg_send_photo_file(payload: dict, photo_url: str) -> dict:
    """Запасной путь: Telegram не смог скачать фото по ссылке — шлём файл сами."""
    token = get_bot_token()
    try:
        with urllib.request.urlopen(photo_url, timeout=20) as r:
            photo_bytes = r.read()
    except Exception as e:
        return {'ok': False, 'description': f'photo download failed: {type(e).__name__}'}

    boundary = '----tgdaily' + uuid.uuid4().hex
    parts = []
    for key, value in payload.items():
        if key == 'photo':
            continue
        if isinstance(value, (dict, list)):
            value = json.dumps(value)
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode())
    parts.append(
        f'--{boundary}\r\nContent-Disposition: form-data; name="photo"; filename="photo.jpg"\r\n'
        f'Content-Type: image/jpeg\r\n\r\n'.encode()
    )
    parts.append(photo_bytes)
    parts.append(f'\r\n--{boundary}--\r\n'.encode())
    body = b''.join(parts)

    last_err = 'fail'
    for host in TG_HOSTS:
        ctx = ssl.create_default_context()
        if host != 'api.telegram.org':
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
        conn = http.client.HTTPSConnection(host, 443, timeout=30, context=ctx)
        try:
            conn.request('POST', f'/bot{token}/sendPhoto', body=body,
                         headers={'Content-Type': f'multipart/form-data; boundary={boundary}',
                                  'Host': 'api.telegram.org'})
            return json.loads(conn.getresponse().read())
        except Exception as e:
            last_err = f'{type(e).__name__}: {str(e)[:150]}'
            print(f'[DAILY] tg sendPhoto(file) via {host} failed: {last_err}')
        finally:
            conn.close()
    return {'ok': False, 'description': last_err}


def strip_html(html_text: str) -> str:
    text = re.sub(r'<[^>]+>', '', html_text or '')
    text = text.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"')
    return text.strip()


def vk_api(method, params, use_user_token: bool = True):
    token = ''
    if use_user_token:
        token = os.environ.get('VK_USER_TOKEN', '') or os.environ.get('VK_ACCESS_TOKEN', '')
    else:
        token = os.environ.get('VK_ACCESS_TOKEN', '') or os.environ.get('VK_USER_TOKEN', '')
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

    import uuid
    boundary = uuid.uuid4().hex
    ext = 'jpg'
    if 'png' in content_type:
        ext = 'png'
    elif 'webp' in content_type:
        ext = 'webp'

    crlf = b'\r\n'
    body = b''
    body += b'--' + boundary.encode() + crlf
    body += f'Content-Disposition: form-data; name="photo"; filename="photo.{ext}"'.encode() + crlf
    body += f'Content-Type: {content_type}'.encode() + crlf
    body += crlf
    body += photo_bytes
    body += crlf
    body += b'--' + boundary.encode() + b'--' + crlf

    req = urllib.request.Request(upload_url, data=body, headers={
        'Content-Type': f'multipart/form-data; boundary={boundary}',
        'Content-Length': str(len(body)),
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
    has_token = bool(os.environ.get('VK_USER_TOKEN') or os.environ.get('VK_ACCESS_TOKEN'))
    if not group_id or not has_token:
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


def vk_upload_photo_user(photo_url: str, user_id: str, log: list):
    """Загружает фото на стену пользователя (без group_id)."""
    try:
        with urllib.request.urlopen(photo_url, timeout=15) as resp:
            photo_bytes = resp.read()
            content_type = resp.headers.get('Content-Type', 'image/jpeg')
        log.append({'step': 'download', 'ok': True, 'size': len(photo_bytes)})
    except Exception as e:
        log.append({'step': 'download', 'ok': False, 'err': str(e)})
        return None

    server = vk_api('photos.getWallUploadServer', {})
    log.append({'step': 'getWallUploadServer', 'resp': server})
    upload_url = server.get('response', {}).get('upload_url')
    if not upload_url:
        return None

    import uuid
    boundary = uuid.uuid4().hex
    ext = 'jpg'
    if 'png' in content_type:
        ext = 'png'
    elif 'webp' in content_type:
        ext = 'webp'

    crlf = b'\r\n'
    body = b''
    body += b'--' + boundary.encode() + crlf
    body += f'Content-Disposition: form-data; name="photo"; filename="photo.{ext}"'.encode() + crlf
    body += f'Content-Type: {content_type}'.encode() + crlf + crlf
    body += photo_bytes + crlf
    body += b'--' + boundary.encode() + b'--' + crlf

    req = urllib.request.Request(upload_url, data=body, headers={
        'Content-Type': f'multipart/form-data; boundary={boundary}',
        'Content-Length': str(len(body)),
    }, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            uploaded = json.loads(resp.read())
        log.append({'step': 'upload', 'resp': uploaded})
    except Exception as e:
        log.append({'step': 'upload', 'ok': False, 'err': str(e)})
        return None

    saved = vk_api('photos.saveWallPhoto', {
        'user_id': user_id,
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


def post_to_vk_user_wall(photo_url: str, text: str, debug: bool = False):
    """Публикует на личную стену пользователя VK_USER_ID."""
    user_id = os.environ.get('VK_USER_ID', '').strip()
    if not user_id:
        return {'ok': False, 'error': 'VK_USER_ID не задан'}
    if not os.environ.get('VK_USER_TOKEN'):
        return {'ok': False, 'error': 'VK_USER_TOKEN не задан'}

    log = []
    attachment = vk_upload_photo_user(photo_url, user_id, log) if photo_url else None
    params = {'owner_id': user_id, 'message': text}
    if attachment:
        params['attachments'] = attachment

    result = vk_api('wall.post', params)
    if 'response' in result:
        out = {'ok': True, 'post_id': result['response'].get('post_id'), 'attachment': attachment}
    else:
        out = {'ok': False, 'error': result.get('error', {}).get('error_msg', 'unknown'), 'attachment': attachment}
    if debug:
        out['log'] = log
    return out


MAX_API_BASE = 'https://platform-api.max.ru'


def get_max_token():
    return (os.environ.get('MAX_BOT_TOKEN_NEW', '') or os.environ.get('MAX_BOT_TOKEN', '')).strip()


def max_upload_image(photo_url: str, token: str, log: list):
    """Загружает фото в MAX и возвращает токен вложения."""
    try:
        with urllib.request.urlopen(photo_url, timeout=15) as resp:
            photo_bytes = resp.read()
            content_type = resp.headers.get('Content-Type', 'image/jpeg')
        log.append({'step': 'max_download', 'ok': True, 'size': len(photo_bytes)})
    except Exception as e:
        log.append({'step': 'max_download', 'ok': False, 'err': str(e)})
        return None

    up_req = urllib.request.Request(f"{MAX_API_BASE}/uploads?type=image", method='POST')
    up_req.add_header('Authorization', token)
    try:
        with urllib.request.urlopen(up_req, timeout=15) as r:
            up = json.loads(r.read().decode('utf-8'))
        upload_url = up.get('url')
        log.append({'step': 'max_getUploadUrl', 'ok': bool(upload_url)})
    except Exception as e:
        log.append({'step': 'max_getUploadUrl', 'ok': False, 'err': str(e)})
        return None
    if not upload_url:
        return None

    import uuid
    boundary = uuid.uuid4().hex
    ext = 'jpg'
    if 'png' in content_type:
        ext = 'png'
    elif 'webp' in content_type:
        ext = 'webp'
    crlf = b'\r\n'
    body = b''
    body += b'--' + boundary.encode() + crlf
    body += f'Content-Disposition: form-data; name="data"; filename="photo.{ext}"'.encode() + crlf
    body += f'Content-Type: {content_type}'.encode() + crlf + crlf
    body += photo_bytes + crlf
    body += b'--' + boundary.encode() + b'--' + crlf

    req = urllib.request.Request(upload_url, data=body, headers={
        'Content-Type': f'multipart/form-data; boundary={boundary}',
        'Content-Length': str(len(body)),
    }, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            uploaded = json.loads(r.read().decode('utf-8'))
        log.append({'step': 'max_upload', 'resp': uploaded})
    except Exception as e:
        log.append({'step': 'max_upload', 'ok': False, 'err': str(e)})
        return None

    photos = uploaded.get('photos') or {}
    if photos:
        first = next(iter(photos.values()))
        return first.get('token')
    return uploaded.get('token')


def post_to_max(photo_url: str, text: str, debug: bool = False):
    """Публикует пост с фото в канал MAX (MAX_CHAT_ID)."""
    token = get_max_token()
    chat_id = (os.environ.get('MAX_CHAT_ID', '') or '').strip()
    if not token:
        return {'ok': False, 'error': 'MAX_BOT_TOKEN не задан'}
    if not chat_id:
        return {'ok': False, 'error': 'MAX_CHAT_ID не задан'}

    log = []
    attachments = []
    img_token = max_upload_image(photo_url, token, log) if photo_url else None
    if img_token:
        attachments.append({'type': 'image', 'payload': {'token': img_token}})

    payload = {'text': text}
    if attachments:
        payload['attachments'] = attachments

    url = f"{MAX_API_BASE}/messages?chat_id={urllib.parse.quote(chat_id)}"
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, method='POST')
    req.add_header('Authorization', token)
    req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            result = json.loads(r.read().decode('utf-8'))
        out = {'ok': True, 'result': result}
    except urllib.error.HTTPError as e:
        try:
            err = e.read().decode('utf-8')
        except Exception:
            err = ''
        out = {'ok': False, 'error': f"HTTP {e.code}: {err[:200]}"}
    except Exception as e:
        out = {'ok': False, 'error': f"{type(e).__name__}: {str(e)[:200]}"}
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


def get_post_by_id(post_id: int):
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    cur.execute(
        f"SELECT id, photo_url, greeting, description FROM {SCHEMA}.bot_daily_posts "
        f"WHERE id = {int(post_id)} LIMIT 1"
    )
    row = cur.fetchone()
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
    forced_id = qs.get('post_id')
    target = (qs.get('target') or '').strip()  # '', 'user_wall'
    if forced_id:
        try:
            row = get_post_by_id(int(forced_id))
        except Exception:
            row = None
        if not row:
            return {'statusCode': 404, 'headers': cors, 'body': json.dumps({'ok': False, 'error': 'post not found'})}
    else:
        row = get_next_post()
        if not row:
            return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'ok': False, 'error': 'no posts'})}

    post_id, photo, greeting, description = row
    tg_text = f"<b>{greeting}</b>\n\n{description}\n{CONTACTS}"
    vk_text = strip_html(f"{greeting}\n\n{description}\n{CONTACTS}")
    max_text = vk_text

    if target == 'user_wall':
        vk_user = post_to_vk_user_wall(photo, vk_text, debug=True)
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({
            'ok': vk_user.get('ok', False), 'post_id': post_id, 'vk_user_wall': vk_user,
        })}

    if target == 'max':
        max_only = post_to_max(photo, max_text, debug=True)
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({
            'ok': max_only.get('ok', False), 'post_id': post_id, 'max': max_only,
        })}

    tg_payload = {
        'chat_id': CHANNEL_ID,
        'photo': photo,
        'caption': tg_text,
        'parse_mode': 'HTML',
    }
    tg_result = tg_api('sendPhoto', tg_payload)
    if not tg_result.get('ok'):
        # Telegram не смог забрать фото по ссылке — отправляем файл напрямую.
        print(f"[DAILY] sendPhoto by url failed: {str(tg_result.get('description'))[:200]}")
        tg_result = tg_send_photo_file(tg_payload, photo)
    if not tg_result.get('ok'):
        # Совсем не вышло с фото — публикуем хотя бы текст, пост не пропадёт.
        print(f"[DAILY] sendPhoto file failed: {str(tg_result.get('description'))[:200]}")
        tg_result = tg_api('sendMessage', {
            'chat_id': CHANNEL_ID,
            'text': tg_text,
            'parse_mode': 'HTML',
        })

    vk_result = post_to_vk(photo, vk_text)
    vk_user_result = post_to_vk_user_wall(photo, vk_text)
    max_result = post_to_max(photo, max_text)

    tg_status = 'ok' if tg_result.get('ok') else f"err:{(tg_result.get('description') or 'fail')[:200]}"
    vk_status = 'ok' if vk_result.get('ok') else f"err:{(vk_result.get('error') or 'fail')[:200]}"
    vk_user_status = 'ok' if vk_user_result.get('ok') else f"err:{(vk_user_result.get('error') or 'fail')[:200]}"
    max_status = 'ok' if max_result.get('ok') else f"err:{(max_result.get('error') or 'fail')[:200]}"
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        tg_safe = tg_status.replace("'", "''")
        vk_safe = vk_status.replace("'", "''")
        vk_user_safe = vk_user_status.replace("'", "''")
        max_safe = max_status.replace("'", "''")
        cur.execute(
            f"UPDATE {SCHEMA}.bot_daily_posts "
            f"SET last_tg_status = '{tg_safe}', last_vk_status = '{vk_safe}', "
            f"last_vk_user_status = '{vk_user_safe}', last_max_status = '{max_safe}', last_sent_at = NOW() "
            f"WHERE id = {post_id}"
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception:
        pass

    return {
        'statusCode': 200,
        'headers': cors,
        'body': json.dumps({
            'ok': tg_result.get('ok', False),
            'post_id': post_id,
            'tg': tg_result.get('ok', False),
            'tg_status': tg_status,
            'vk': vk_result,
            'vk_status': vk_status,
            'vk_user': vk_user_result,
            'vk_user_status': vk_user_status,
            'max': max_result,
            'max_status': max_status,
        }),
    }