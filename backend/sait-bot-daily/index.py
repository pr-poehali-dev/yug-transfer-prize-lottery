"""Ежедневная рассылка контактов ЮГ ТРАНСФЕР в Telegram."""
import os
import json
import urllib.request
from datetime import date
import psycopg2

CHANNEL_ID = '@ug_transfer_pro'
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')

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
🎁 <b>БОНУСЫ ДЛЯ КЛИЕНТОВ:</b>

💎 Кэшбэк до 10% с каждой поездки
🎰 Бесплатные розыгрыши призов
🏆 Программа лояльности
⭐️ Скидки постоянным клиентам

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
    """Ежедневный пост: отправка в Telegram @ug_transfer_pro."""
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
    text = f"<b>{greeting}</b>\n\n{description}\n{CONTACTS}"

    tg_result = tg_api('sendPhoto', {
        'chat_id': CHANNEL_ID,
        'photo': photo,
        'caption': text,
        'parse_mode': 'HTML',
    })

    return {
        'statusCode': 200,
        'headers': cors,
        'body': json.dumps({
            'ok': tg_result.get('ok', False),
            'post_id': post_id,
        }),
    }