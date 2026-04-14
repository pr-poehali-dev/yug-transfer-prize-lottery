"""Ежедневная рассылка контактов ЮГ ТРАНСФЕР через бот @ug_sait_bot."""
import os
import json
import random
import urllib.request
from datetime import date
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')

PHOTOS = [
    'https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/d119b7ec-356e-4888-9b28-0660cb78b9ac.jpg',
    'https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/96527428-6821-4e81-99d0-282c2f72809c.jpg',
    'https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/864ce8e0-73e8-446d-9bfe-e3831f917277.jpg',
    'https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/1ffc951f-8636-478c-919d-1c374d81a4d4.jpg',
    'https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/28e1f3d4-901c-4fb4-83f2-3de2e23dca47.jpg',
]

GREETINGS = [
    '🚕 Планируете поездку? Мы всегда на связи!',
    '🚕 Нужно такси? ЮГ ТРАНСФЕР к вашим услугам!',
    '🚕 Комфортная поездка начинается с одного звонка!',
    '🚕 Куда едем? ЮГ ТРАНСФЕР доставит быстро и с комфортом!',
    '🚕 Трансфер по югу России — легко и удобно!',
    '🚕 Надёжный водитель уже ждёт вашего заказа!',
    '🚕 Путешествуйте с комфортом — выбирайте ЮГ ТРАНСФЕР!',
    '🚕 Быстро, безопасно, по лучшей цене — это ЮГ ТРАНСФЕР!',
    '🚕 Ваш персональный трансфер на юге России!',
    '🚕 Аэропорт, вокзал, отель — довезём куда угодно!',
    '🚕 Заказывайте такси заранее — будьте уверены в поездке!',
    '🚕 ЮГ ТРАНСФЕР — ваш надёжный партнёр в дороге!',
    '🚕 Едете на море? Закажите трансфер прямо сейчас!',
    '🚕 Поездка с ЮГ ТРАНСФЕР — всегда приятное путешествие!',
    '🚕 Встретим в аэропорту, довезём до двери!',
]

DESCRIPTIONS = [
    'Комфортные автомобили, опытные водители, фиксированные цены.',
    'Работаем 24/7. Подача от 10 минут в любую точку.',
    'Индивидуальный подход к каждому клиенту. Детские кресла по запросу.',
    'Без скрытых доплат. Цена фиксируется при заказе.',
    'Поездки по всему югу России: море, горы, города.',
    'Чистые авто, вежливые водители, точно в срок.',
    'Групповые поездки, трансферы, экскурсии — всё для вас.',
    'Встреча с табличкой в аэропорту, помощь с багажом.',
    'Ваш комфорт — наш приоритет. Кондиционер, Wi-Fi, вода.',
    'Бронируйте заранее — гарантируем подачу вовремя.',
]

CONTACTS = """
<b>Свяжитесь с нами удобным способом:</b>

📞 Телефон: +7 (995) 614-14-14
💬 WhatsApp: wa.me/79956141414
✈️ Telegram: @ug_transfer_online
🌐 Онлайн: ug-transfer.online
🤖 Бот для заказа: @ug_sait_bot"""


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


def generate_post():
    today = date.today()
    random.seed(today.toordinal())
    greeting = random.choice(GREETINGS)
    desc = random.choice(DESCRIPTIONS)
    photo = random.choice(PHOTOS)
    text = f"{greeting}\n\n{desc}\n{CONTACTS}"
    return photo, text


def get_subscribers():
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    cur.execute(f"SELECT chat_id FROM {SCHEMA}.sait_bot_users")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [r[0] for r in rows]


def handler(event: dict, context) -> dict:
    """Ежедневная рассылка контактов ЮГ ТРАНСФЕР всем подписчикам бота @ug_sait_bot."""
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    photo, text = generate_post()
    subscribers = get_subscribers()
    sent = 0
    failed = 0

    for chat_id in subscribers:
        result = tg_api('sendPhoto', {
            'chat_id': chat_id,
            'photo': photo,
            'caption': text,
            'parse_mode': 'HTML',
        })
        if result.get('ok'):
            sent += 1
        else:
            failed += 1

    return {
        'statusCode': 200,
        'headers': cors,
        'body': json.dumps({'ok': True, 'sent': sent, 'failed': failed, 'total': len(subscribers)}),
    }
