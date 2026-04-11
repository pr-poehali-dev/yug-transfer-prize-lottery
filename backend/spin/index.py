"""
Рулетка розыгрыша.
POST (admin) — запустить колесо: берёт участников розыгрыша, выбирает победителя, сохраняет в БД, отправляет в Telegram.
GET (public) — текущее состояние колеса (spinning / revealed).
"""
import os
import json
import random
import hashlib
import urllib.request
import psycopg2

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
}

SCHEMA = 't_p67171637_yug_transfer_prize_l'


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def get_token():
    login = os.environ.get('ADMIN_LOGIN', '')
    password = os.environ.get('ADMIN_PASSWORD', '')
    return hashlib.sha256(f"{login}:{password}:admin_secret_2026".encode()).hexdigest()


def send_tg(chat_id: str, text: str, bot_token: str):
    payload = json.dumps({'chat_id': chat_id, 'text': text, 'parse_mode': 'HTML', 'disable_web_page_preview': False}).encode()
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{bot_token}/sendMessage",
        data=payload, headers={'Content-Type': 'application/json'}, method='POST'
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            print(f"[TG spin {chat_id}] OK: {r.read().decode()[:100]}")
    except Exception as e:
        print(f"[TG spin {chat_id}] ERROR: {e}")


def notify_spin_start(raffle_title: str):
    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN', '')
    channel_id = os.environ.get('TELEGRAM_CHANNEL_ID', '')
    group_id = os.environ.get('TELEGRAM_GROUP_ID', '')
    if not bot_token:
        return

    text = (
        f"🎰 <b>Розыгрыш остановлен!</b>\n\n"
        f"🏆 <b>{raffle_title}</b>\n\n"
        f"⚡️ Прямо сейчас в реальном времени крутится колесо и выбирается победитель!\n\n"
        f"👀 Смотри на сайте — победитель уже определяется:\n"
        f"<a href=\"https://ug-gift.ru\">👉 ug-gift.ru</a>"
    )

    for chat_id in filter(None, [channel_id, group_id]):
        send_tg(chat_id, text, bot_token)


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')

    # GET — публичный статус текущего колеса
    if method == 'GET':
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            f"SELECT id, raffle_id, raffle_title, participants, winner_name, winner_photo, status, started_at, reveal_at "
            f"FROM {SCHEMA}.raffle_spin ORDER BY id DESC LIMIT 1"
        )
        row = cur.fetchone()
        cur.close()
        conn.close()

        if not row:
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'spin': None})}

        spin = {
            'id': row[0],
            'raffle_id': row[1],
            'raffle_title': row[2],
            'participants': row[3],
            'winner_name': row[4],
            'winner_photo': row[5],
            'status': row[6],
            'started_at': row[7].isoformat(),
            'reveal_at': row[8].isoformat(),
        }
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'spin': spin})}

    # POST — только для админа: запустить колесо
    token = event.get('headers', {}).get('X-Admin-Token', '')
    if token != get_token():
        return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Unauthorized'})}

    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Invalid JSON'})}

    raffle_id = body.get('raffle_id')
    raffle_title = body.get('raffle_title', '')

    conn = get_conn()
    cur = conn.cursor()

    # Берём участников розыгрыша из entries + users
    cur.execute(
        f"""SELECT DISTINCT u.id, u.first_name, u.last_name, u.username, u.photo_url
            FROM {SCHEMA}.entries e
            JOIN {SCHEMA}.users u ON u.id = e.user_id
            WHERE e.raffle_id = %s""",
        (raffle_id,)
    )
    rows = cur.fetchall()

    if not rows:
        # Если участников нет — берём всех пользователей
        cur.execute(f"SELECT id, first_name, last_name, username, photo_url FROM {SCHEMA}.users")
        rows = cur.fetchall()

    participants = [
        {
            'id': r[0],
            'name': ' '.join(filter(None, [r[1], r[2]])) or r[3] or f'User #{r[0]}',
            'photo': r[4] or '',
        }
        for r in rows
    ]

    # Выбираем победителя случайно
    winner = random.choice(participants)

    # Сохраняем спин в БД (колесо крутится 60 секунд, потом reveal)
    cur.execute(
        f"""INSERT INTO {SCHEMA}.raffle_spin
            (raffle_id, raffle_title, participants, winner_name, winner_photo, status, reveal_at)
            VALUES (%s, %s, %s, %s, %s, 'spinning', now() + interval '60 seconds')
            RETURNING id, started_at, reveal_at""",
        (raffle_id, raffle_title, json.dumps(participants), winner['name'], winner['photo'])
    )
    spin_row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()

    # Уведомление в Telegram
    notify_spin_start(raffle_title)

    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({
        'ok': True,
        'spin_id': spin_row[0],
        'winner_name': winner['name'],
        'participants_count': len(participants),
        'reveal_at': spin_row[2].isoformat(),
    })}
