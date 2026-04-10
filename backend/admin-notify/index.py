"""
Рассылка уведомлений всем клиентам через Telegram Bot API и сохранение в базу.
"""
import os
import json
import hashlib
import psycopg2
import urllib.request

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
}

SCHEMA = 't_p67171637_yug_transfer_prize_l'


def verify_token(token: str) -> bool:
    admin_login = os.environ.get('ADMIN_LOGIN', '')
    admin_password = os.environ.get('ADMIN_PASSWORD', '')
    token_base = f"{admin_login}:{admin_password}:admin_secret_2026"
    return token == hashlib.sha256(token_base.encode()).hexdigest()


def send_telegram_message(bot_token: str, chat_id: int, text: str) -> bool:
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = json.dumps({'chat_id': chat_id, 'text': text, 'parse_mode': 'HTML'}).encode()
    req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status == 200
    except Exception:
        return False


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    token = event.get('headers', {}).get('X-Admin-Token', '')
    if not verify_token(token):
        return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Unauthorized'})}

    # GET — история рассылок
    if event.get('httpMethod') == 'GET':
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(f"SELECT id, title, message, type, sent_at, recipients_count FROM {SCHEMA}.notifications ORDER BY sent_at DESC LIMIT 50")
        rows = cur.fetchall()
        cur.close()
        conn.close()
        history = [{'id': r[0], 'title': r[1], 'message': r[2], 'type': r[3], 'sent_at': str(r[4]), 'recipients_count': r[5]} for r in rows]
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'history': history})}

    # POST — отправить рассылку
    body = json.loads(event.get('body') or '{}')
    title = body.get('title', '').strip()
    message = body.get('message', '').strip()
    notif_type = body.get('type', 'info')

    if not title or not message:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'title и message обязательны'})}

    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN', '')

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()

    cur.execute(f"SELECT telegram_id FROM {SCHEMA}.users")
    telegram_ids = [r[0] for r in cur.fetchall()]

    sent_count = 0
    if bot_token:
        emoji = {'info': 'ℹ️', 'promo': '🎁', 'winner': '🏆', 'raffle': '🎰'}.get(notif_type, '📢')
        full_text = f"{emoji} <b>{title}</b>\n\n{message}\n\n<i>ЮГ ТРАНСФЕР — ug-gift.ru</i>"
        for tg_id in telegram_ids:
            if send_telegram_message(bot_token, tg_id, full_text):
                sent_count += 1

    cur.execute(
        f"INSERT INTO {SCHEMA}.notifications (title, message, type, recipients_count) VALUES (%s, %s, %s, %s) RETURNING id",
        (title, message, notif_type, sent_count)
    )
    notif_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()

    return {
        'statusCode': 200,
        'headers': CORS,
        'body': json.dumps({'ok': True, 'id': notif_id, 'sent': sent_count, 'total': len(telegram_ids)})
    }
