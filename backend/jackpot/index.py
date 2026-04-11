"""
Джекпот: GET — баланс и дата следующего розыгрыша. POST (admin) — провести розыгрыш (выбрать победителя среди всех пользователей).
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


def notify_jackpot_winner(winner_name: str, balance: int):
    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN', '')
    channel_id = os.environ.get('TELEGRAM_CHANNEL_ID', '')
    group_id = os.environ.get('TELEGRAM_GROUP_ID', '')
    if not bot_token:
        return

    text = (
        f"💎 <b>ДЖЕКПОТ РАЗЫГРАН!</b>\n\n"
        f"🏆 Победитель: <b>{winner_name}</b>\n"
        f"💰 Сумма выигрыша: <b>{balance:,} ₽</b>\n\n".replace(',', ' ') +
        f"🎉 Поздравляем! Следующий джекпот через 6 месяцев!\n"
        f"<a href=\"https://ug-gift.ru\">👉 ug-gift.ru</a>"
    )

    def send_to(chat_id):
        payload = json.dumps({'chat_id': chat_id, 'text': text, 'parse_mode': 'HTML'}).encode()
        req = urllib.request.Request(f"https://api.telegram.org/bot{bot_token}/sendMessage",
            data=payload, headers={'Content-Type': 'application/json'}, method='POST')
        try:
            urllib.request.urlopen(req, timeout=10)
        except Exception as e:
            print(f"[TG jackpot {chat_id}] ERROR: {e}")

    if channel_id:
        send_to(channel_id)
    if group_id:
        send_to(group_id)


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')

    if method == 'GET':
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"SELECT id, balance, next_draw_at, last_winner, last_draw_at FROM {SCHEMA}.jackpot WHERE id = 1")
        row = cur.fetchone()
        cur.close()
        conn.close()
        if not row:
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'balance': 0, 'next_draw_at': None, 'last_winner': None})}
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({
            'ok': True,
            'balance': row[1],
            'next_draw_at': row[2].isoformat() if row[2] else None,
            'last_winner': row[3],
            'last_draw_at': row[4].isoformat() if row[4] else None,
        })}

    # POST — провести розыгрыш (только для админа)
    token = event.get('headers', {}).get('X-Admin-Token', '')
    if token != get_token():
        return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Unauthorized'})}

    conn = get_conn()
    cur = conn.cursor()

    # Берём текущий баланс
    cur.execute(f"SELECT balance FROM {SCHEMA}.jackpot WHERE id = 1")
    row = cur.fetchone()
    balance = row[0] if row else 0

    if balance <= 0:
        cur.close()
        conn.close()
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Джекпот пуст'})}

    # Случайный победитель среди всех пользователей
    cur.execute(f"SELECT id, first_name, last_name, username FROM {SCHEMA}.users ORDER BY random() LIMIT 1")
    user = cur.fetchone()
    if not user:
        cur.close()
        conn.close()
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Нет пользователей'})}

    winner_name = ' '.join(filter(None, [user[1], user[2]])) or user[3] or f'User #{user[0]}'

    # Сбрасываем баланс, сохраняем победителя, следующий розыгрыш через 6 месяцев
    cur.execute(
        f"UPDATE {SCHEMA}.jackpot SET balance = 0, last_winner = %s, last_draw_at = now(), next_draw_at = now() + interval '6 months' WHERE id = 1",
        (winner_name,)
    )
    conn.commit()
    cur.close()
    conn.close()

    notify_jackpot_winner(winner_name, balance)

    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({
        'ok': True,
        'winner': winner_name,
        'amount': balance,
    })}
