"""
CRUD для розыгрышей. GET — список, POST — создать, PUT — обновить, DELETE — удалить.
Изменение данных требует заголовок X-Admin-Token.
При завершении розыгрыша считает излишек (сверх target_amount) и зачисляет в джекпот.
"""
import os
import json
import hashlib
import base64
import urllib.request
import psycopg2
import boto3
from pywebpush import webpush, WebPushException

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
}

SCHEMA = 't_p67171637_yug_transfer_prize_l'


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def upload_raffle_photo(data_url: str, raffle_id: int) -> str:
    header, encoded = data_url.split(',', 1)
    ext = 'jpg' if 'jpeg' in header else 'png'
    data = base64.b64decode(encoded)
    s3 = boto3.client('s3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'])
    key = f'raffles/raffle_{raffle_id}.{ext}'
    s3.put_object(Bucket='files', Key=key, Body=data, ContentType=f'image/{ext}')
    return f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"


def get_token():
    login = os.environ.get('ADMIN_LOGIN', '')
    password = os.environ.get('ADMIN_PASSWORD', '')
    return hashlib.sha256(f"{login}:{password}:admin_secret_2026".encode()).hexdigest()


def row_to_dict(row):
    return {
        'id': row[0],
        'title': row[1],
        'prize': row[2],
        'prize_icon': row[3],
        'end_date': row[4].isoformat() if row[4] else None,
        'participants': row[5],
        'min_amount': row[6],
        'status': row[7],
        'gradient': row[8],
        'winner': row[9],
        'photo_url': row[10] if len(row) > 10 else None,
        'target_amount': row[11] if len(row) > 11 else 0,
    }


def add_to_jackpot(conn, amount: int, raffle_title: str):
    """Зачисляет излишек в джекпот."""
    if amount <= 0:
        return
    cur = conn.cursor()
    cur.execute(
        f"UPDATE {SCHEMA}.jackpot SET balance = balance + %s WHERE id = 1",
        (amount,)
    )
    print(f"[JACKPOT] +{amount} ₽ from '{raffle_title}'")
    cur.close()


def calc_jackpot_surplus(conn, raffle_id: int, target_amount: int) -> int:
    """Считает сумму платежей по розыгрышу и возвращает излишек сверх target_amount."""
    if not target_amount or target_amount <= 0:
        return 0
    cur = conn.cursor()
    cur.execute(
        f"SELECT COALESCE(SUM(amount), 0) FROM {SCHEMA}.entries WHERE raffle_id = %s",
        (raffle_id,)
    )
    total = cur.fetchone()[0] or 0
    cur.close()
    surplus = max(0, int(total) - int(target_amount))
    print(f"[JACKPOT] raffle {raffle_id}: total={total}, target={target_amount}, surplus={surplus}")
    return surplus


def notify_channel_new_raffle(raffle: dict):
    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN', '')
    channel_id = os.environ.get('TELEGRAM_CHANNEL_ID', '')
    if not bot_token or not channel_id:
        return

    end_date = raffle.get('end_date', '')[:10] if raffle.get('end_date') else '—'
    target = raffle.get('target_amount', 0)
    target_line = f"🎯 Цель сбора: <b>{target:,} ₽</b>\n".replace(',', ' ') if target else ''
    text = (
        f"🎰 <b>Новый розыгрыш!</b>\n\n"
        f"🏆 <b>{raffle['title']}</b>\n"
        f"🎁 Приз: <b>{raffle['prize']}</b>\n"
        f"💰 Взнос: <b>{raffle['min_amount']} ₽</b>\n"
        f"{target_line}"
        f"📅 До: <b>{end_date}</b>\n\n"
        f"🔥 Залетай и испытай удачу!\n"
        f"<a href=\"https://ug-gift.ru\">👉 ug-gift.ru</a>"
    )
    photo_url = raffle.get('photo_url') or "https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/bucket/4be15897-c9ea-4e8c-a28f-3d9f2a91fdd7.png"
    payload = json.dumps({'chat_id': channel_id, 'photo': photo_url, 'caption': text, 'parse_mode': 'HTML'}).encode()
    req = urllib.request.Request(f"https://api.telegram.org/bot{bot_token}/sendPhoto",
        data=payload, headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            print(f"[TG new raffle] OK: {r.read().decode()[:100]}")
    except Exception as e:
        print(f"[TG new raffle] ERROR: {e}")


def notify_channel_winner(raffle: dict, surplus: int = 0):
    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN', '')
    channel_id = os.environ.get('TELEGRAM_CHANNEL_ID', '')
    group_id = os.environ.get('TELEGRAM_GROUP_ID', '')
    if not bot_token:
        return

    winner = raffle.get('winner', '—')
    surplus_line = f"\n💎 <b>{surplus:,} ₽</b> ушло в джекпот!\n".replace(',', ' ') if surplus > 0 else ''
    text = (
        f"🏆 <b>Розыгрыш завершён!</b>\n\n"
        f"🎰 <b>{raffle['title']}</b>\n"
        f"🎁 Приз: <b>{raffle['prize']}</b>\n\n"
        f"🥇 Победитель: <b>{winner}</b>\n"
        f"{surplus_line}\n"
        f"🔥 Следи за новыми розыгрышами:\n"
        f"<a href=\"https://ug-gift.ru\">👉 ug-gift.ru</a>"
    )
    photo_url = raffle.get('photo_url') or "https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/bucket/4be15897-c9ea-4e8c-a28f-3d9f2a91fdd7.png"

    def send_to(chat_id):
        payload = json.dumps({'chat_id': chat_id, 'photo': photo_url, 'caption': text, 'parse_mode': 'HTML'}).encode()
        req = urllib.request.Request(f"https://api.telegram.org/bot{bot_token}/sendPhoto",
            data=payload, headers={'Content-Type': 'application/json'}, method='POST')
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                print(f"[TG winner {chat_id}] OK: {r.read().decode()[:100]}")
        except Exception as e:
            print(f"[TG winner {chat_id}] ERROR: {e}")
            try:
                mp = json.dumps({'chat_id': chat_id, 'text': text, 'parse_mode': 'HTML'}).encode()
                mr = urllib.request.Request(f"https://api.telegram.org/bot{bot_token}/sendMessage",
                    data=mp, headers={'Content-Type': 'application/json'}, method='POST')
                urllib.request.urlopen(mr, timeout=10)
            except Exception as e2:
                print(f"[TG winner msg {chat_id}] ERROR: {e2}")

    if channel_id:
        send_to(channel_id)
    if group_id:
        send_to(group_id)


def send_winner_push(raffle_title: str, prize: str, winner: str):
    vapid_private = os.environ.get('VAPID_PRIVATE_KEY', '')
    if not vapid_private:
        return
    vapid_claims = {'sub': 'mailto:admin@ug-gift.ru'}
    payload = json.dumps({
        'title': '🏆 Объявлен победитель!',
        'body': f'{raffle_title} — победитель: {winner}. Приз: {prize}',
        'url': '/',
        'tag': 'raffle-winner',
    })
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"SELECT endpoint, p256dh, auth FROM {SCHEMA}.push_subscriptions")
        rows = cur.fetchall()
        cur.close()
        conn.close()
    except Exception:
        return
    for endpoint, p256dh, auth in rows:
        try:
            webpush(
                subscription_info={'endpoint': endpoint, 'keys': {'p256dh': p256dh, 'auth': auth}},
                data=payload,
                vapid_private_key=vapid_private,
                vapid_claims=vapid_claims,
            )
        except (WebPushException, Exception):
            pass


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')

    # GET — публичный список
    if method == 'GET':
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            f"SELECT id, title, prize, prize_icon, end_date, participants, min_amount, status, gradient, winner, photo_url, target_amount "
            f"FROM {SCHEMA}.raffles ORDER BY created_at DESC"
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'raffles': [row_to_dict(r) for r in rows]})}

    # POST/PUT/DELETE — только для админа
    token = event.get('headers', {}).get('X-Admin-Token', '')
    if token != get_token():
        return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Unauthorized'})}

    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Invalid JSON'})}

    conn = get_conn()
    cur = conn.cursor()

    if method == 'POST':
        cur.execute(
            f"""INSERT INTO {SCHEMA}.raffles (title, prize, prize_icon, end_date, participants, min_amount, status, gradient, winner, target_amount)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, title, prize, prize_icon, end_date, participants, min_amount, status, gradient, winner, photo_url, target_amount""",
            (body['title'], body['prize'], body.get('prize_icon', 'Gift'),
             body['end_date'], body.get('participants', 0), body['min_amount'],
             body.get('status', 'active'), body.get('gradient', 'from-purple-600 via-pink-500 to-orange-400'),
             body.get('winner'), body.get('target_amount', 0))
        )
        row = cur.fetchone()
        raffle_id = row[0]

        photo_url = None
        photo_data = body.get('photo_data', '')
        if photo_data and photo_data.startswith('data:'):
            try:
                photo_url = upload_raffle_photo(photo_data, raffle_id)
                cur.execute(f"UPDATE {SCHEMA}.raffles SET photo_url = %s WHERE id = %s", (photo_url, raffle_id))
            except Exception as e:
                print(f"Photo upload error: {e}")

        conn.commit()
        cur.close()
        conn.close()

        raffle = row_to_dict(row)
        if photo_url:
            raffle['photo_url'] = photo_url

        notify_channel_new_raffle(raffle)
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'raffle': raffle})}

    if method == 'PUT':
        rid = body.get('id')

        cur.execute(f"SELECT status, winner, target_amount FROM {SCHEMA}.raffles WHERE id=%s", (rid,))
        prev = cur.fetchone()
        prev_status = prev[0] if prev else None
        prev_winner = prev[1] if prev else None
        prev_target = prev[2] if prev else 0

        photo_url_put = None
        photo_data = body.get('photo_data', '')
        if photo_data and photo_data.startswith('data:'):
            try:
                photo_url_put = upload_raffle_photo(photo_data, rid)
            except Exception as e:
                print(f"Photo upload error: {e}")

        target_amount = body.get('target_amount', prev_target or 0)

        if photo_url_put:
            cur.execute(
                f"""UPDATE {SCHEMA}.raffles SET title=%s, prize=%s, prize_icon=%s, end_date=%s,
                    participants=%s, min_amount=%s, status=%s, gradient=%s, winner=%s, photo_url=%s, target_amount=%s
                    WHERE id=%s
                    RETURNING id, title, prize, prize_icon, end_date, participants, min_amount, status, gradient, winner, photo_url, target_amount""",
                (body['title'], body['prize'], body.get('prize_icon', 'Gift'),
                 body['end_date'], body.get('participants', 0), body['min_amount'],
                 body.get('status', 'active'), body.get('gradient', 'from-purple-600 via-pink-500 to-orange-400'),
                 body.get('winner'), photo_url_put, target_amount, rid)
            )
        else:
            cur.execute(
                f"""UPDATE {SCHEMA}.raffles SET title=%s, prize=%s, prize_icon=%s, end_date=%s,
                    participants=%s, min_amount=%s, status=%s, gradient=%s, winner=%s, target_amount=%s
                    WHERE id=%s
                    RETURNING id, title, prize, prize_icon, end_date, participants, min_amount, status, gradient, winner, photo_url, target_amount""",
                (body['title'], body['prize'], body.get('prize_icon', 'Gift'),
                 body['end_date'], body.get('participants', 0), body['min_amount'],
                 body.get('status', 'active'), body.get('gradient', 'from-purple-600 via-pink-500 to-orange-400'),
                 body.get('winner'), target_amount, rid)
            )
        row = cur.fetchone()

        if not row:
            conn.commit()
            cur.close()
            conn.close()
            return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Not found'})}

        raffle = row_to_dict(row)
        new_status = raffle.get('status')
        new_winner = raffle.get('winner')
        surplus = 0

        # Если розыгрыш только что завершён — считаем излишек и пишем в джекпот
        if new_status == 'ended' and new_winner and (prev_status != 'ended' or prev_winner != new_winner):
            surplus = calc_jackpot_surplus(conn, rid, raffle.get('target_amount', 0))
            if surplus > 0:
                add_to_jackpot(conn, surplus, raffle['title'])

        conn.commit()
        cur.close()
        conn.close()

        if new_status == 'ended' and new_winner and (prev_status != 'ended' or prev_winner != new_winner):
            notify_channel_winner(raffle, surplus)
            send_winner_push(raffle['title'], raffle['prize'], new_winner)

        raffle['jackpot_surplus'] = surplus
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'raffle': raffle})}

    if method == 'DELETE':
        rid = body.get('id')
        cur.execute(f"DELETE FROM {SCHEMA}.raffles WHERE id=%s", (rid,))
        conn.commit()
        cur.close()
        conn.close()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

    cur.close()
    conn.close()
    return {'statusCode': 405, 'headers': CORS, 'body': json.dumps({'error': 'Method not allowed'})}
