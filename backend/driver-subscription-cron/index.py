"""
Business: Cron-функция (запуск раз в день). Шлёт напоминания водителям за 3 дня до истечения подписки и уведомление при истечении.
Args: event с httpMethod
Returns: {ok: True, reminded: N, expired: N}
"""
import json
import os
import urllib.request
from datetime import datetime, timedelta
import psycopg2

BOT_TOKEN = os.environ.get('DRIVER_BOT_TOKEN', '')
DB_URL = os.environ.get('DATABASE_URL', '')


def tg_send(chat_id: int, text: str) -> None:
    if not BOT_TOKEN:
        return
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    data = json.dumps({'chat_id': chat_id, 'text': text}).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    try:
        urllib.request.urlopen(req, timeout=10).read()
    except Exception:
        pass


def handler(event: dict, context) -> dict:
    headers = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': headers, 'body': ''}

    reminded = 0
    expired = 0
    conn = psycopg2.connect(DB_URL)
    try:
        cur = conn.cursor()
        now = datetime.utcnow()
        soon = now + timedelta(days=3)

        cur.execute("""
            SELECT telegram_id, expires_at FROM driver_subscriptions
            WHERE status = 'active' AND reminder_3d_sent = FALSE
              AND expires_at > %s AND expires_at <= %s
        """, (now, soon))
        for tg_id, exp in cur.fetchall():
            tg_send(tg_id, f"⏰ Через 3 дня заканчивается ваша подписка водителя ({exp.strftime('%d.%m.%Y')}).\n\nЧтобы продлить и сохранить комиссию 10%, нажмите /start.")
            cur.execute("UPDATE driver_subscriptions SET reminder_3d_sent = TRUE, updated_at = NOW() WHERE telegram_id = %s", (tg_id,))
            reminded += 1

        cur.execute("""
            SELECT telegram_id FROM driver_subscriptions
            WHERE status = 'active' AND expired_notify_sent = FALSE AND expires_at <= %s
        """, (now,))
        for (tg_id,) in cur.fetchall():
            tg_send(tg_id, "❌ Ваша подписка водителя закончилась.\n\nКомиссия по заказам теперь 15%.\nЧтобы вернуть 10%, оформите подписку заново через /start.")
            cur.execute("UPDATE driver_subscriptions SET status = 'expired', expired_notify_sent = TRUE, updated_at = NOW() WHERE telegram_id = %s", (tg_id,))
            expired += 1

        conn.commit()
    finally:
        conn.close()

    return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'ok': True, 'reminded': reminded, 'expired': expired})}
