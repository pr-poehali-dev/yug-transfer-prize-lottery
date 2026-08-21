"""Telegram-бот @ug_sait_bot — открывает сайт ug-transfer.online как Web App."""
import os
import json
import urllib.request
import ssl
import http.client
import psycopg2

SITE_URL = 'https://ug-transfer.online'
PIN_TEXT = (
    '🚕 <b>ЮГ-Трансфер — заказ такси</b>\n\n'
    'Нажмите кнопку ниже, чтобы рассчитать стоимость и оформить поездку.\n'
    'Работаем по всей России · Трансферы · Межгород'
)
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')


def get_bot_token():
    return os.environ.get('TELEGRAM_BOT_TOKEN_2', '')


TG_HOSTS = ['149.154.167.220', '149.154.167.99', '91.108.56.130', 'api.telegram.org']
LAST_OK_HOST = ''


def tg_api(method, payload, timeout=8, hosts=None):
    """Запрос к Telegram: из облака часть адресов недоступна, перебираем рабочие."""
    data = json.dumps(payload).encode()
    for host in (hosts or TG_HOSTS):
        ctx = ssl.create_default_context()
        if host != 'api.telegram.org':
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
        conn = http.client.HTTPSConnection(host, 443, timeout=timeout, context=ctx)
        try:
            conn.request('POST', f'/bot{get_bot_token()}/{method}', body=data,
                         headers={'Content-Type': 'application/json', 'Host': 'api.telegram.org'})
            result = json.loads(conn.getresponse().read())
            global LAST_OK_HOST
            LAST_OK_HOST = host
            return result
        except Exception as e:
            print(f'[SITE-BOT] {method} via {host} failed: {type(e).__name__}')
        finally:
            conn.close()
    return {}


def delete_pin_service_message(conn_id: str, chat_id, message_id: int) -> bool:
    """Убирает служебную строку «X закрепил(а) сообщение» из переписки."""
    res = tg_api('deleteBusinessMessages', {
        'business_connection_id': conn_id,
        'message_ids': [message_id],
    }, timeout=4, hosts=[LAST_OK_HOST] if LAST_OK_HOST else None)
    if not res.get('ok'):
        res = tg_api('deleteMessage', {
            'business_connection_id': conn_id,
            'chat_id': chat_id,
            'message_id': message_id,
        }, timeout=4, hosts=[LAST_OK_HOST] if LAST_OK_HOST else None)
    ok = bool(res.get('ok'))
    print(f"[SITE-BOT] del pin-service chat={chat_id} msg={message_id} ok={ok} err={str(res.get('description'))[:120]}")
    return ok


def greet_business_chat(bm: dict) -> None:
    """Первое обращение клиента в личку @ug_transfer_online — шлём и закрепляем блок заказа."""
    chat = bm.get('chat') or {}
    sender = bm.get('from') or {}
    chat_id = chat.get('id')
    conn_id = bm.get('business_connection_id', '')

    if not chat_id or chat.get('type') != 'private':
        return
    if sender.get('is_bot') or int(sender.get('id') or 0) != int(chat_id):
        return

    conn = None
    uname = str(sender.get('username') or '').replace("'", "''")
    fname = str(sender.get('first_name') or '').replace("'", "''")
    cid = str(conn_id).replace("'", "''")
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO {SCHEMA}.business_greeted (chat_id, connection_id, username, first_name, message_id, pinned) "
            f"VALUES ({int(chat_id)}, '{cid}', '{uname}', '{fname}', 0, false) "
            f"ON CONFLICT (chat_id) DO NOTHING RETURNING chat_id"
        )
        reserved = cur.fetchone()
        conn.commit()
        cur.close()
        if not reserved:
            conn.close()
            return
    except Exception:
        if conn:
            conn.close()
        return

    res = tg_api('sendMessage', {
        'business_connection_id': conn_id,
        'chat_id': chat_id,
        'text': PIN_TEXT,
        'parse_mode': 'HTML',
        'reply_markup': {
            'inline_keyboard': [[{'text': '🚕 Заказать такси', 'url': SITE_URL}]],
        },
    })
    msg_id = (res.get('result') or {}).get('message_id')
    if not msg_id:
        # Не отправилось — снимаем бронь, попробуем на следующем сообщении клиента.
        print(f"[SITE-BOT] greet send failed chat={chat_id} err={str(res.get('description'))[:200]}")
        try:
            cur = conn.cursor()
            cur.execute(f"DELETE FROM {SCHEMA}.business_greeted WHERE chat_id = {int(chat_id)} AND message_id = 0")
            conn.commit()
            cur.close()
        except Exception:
            pass
        conn.close()
        return

    pin = tg_api('pinChatMessage', {
        'business_connection_id': conn_id,
        'chat_id': chat_id,
        'message_id': msg_id,
        'disable_notification': True,
    }, timeout=3, hosts=[LAST_OK_HOST] if LAST_OK_HOST else None)
    pinned = bool(pin.get('ok'))
    if not pinned:
        print(f"[SITE-BOT] pin failed chat={chat_id} err={str(pin.get('description'))[:200]}")
    print(f'[SITE-BOT] business greet chat={chat_id} msg={msg_id} pinned={pinned}')

    # Telegram сам добавляет служебную строку «... закрепил(а) сообщение» — убираем её.
    if pinned:
        delete_pin_service_message(conn_id, chat_id, int(msg_id) + 1)

    try:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE {SCHEMA}.business_greeted SET message_id = {int(msg_id)}, pinned = {pinned} "
            f"WHERE chat_id = {int(chat_id)}"
        )
        conn.commit()
        cur.close()
    except Exception:
        pass
    finally:
        conn.close()


def handler(event: dict, context) -> dict:
    """Обработчик бота @ug_sait_bot — Web App кнопка для открытия сайта."""
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    if event.get('httpMethod') == 'GET':
        qs = event.get('queryStringParameters') or {}
        if qs.get('action') == 'bot_info':
            result = tg_api('getMe', {})
            bot = result.get('result', {})
            wh = tg_api('getWebhookInfo', {})
            wh_url = wh.get('result', {}).get('url', '')
            return {
                'statusCode': 200,
                'headers': cors,
                'body': json.dumps({'ok': True, 'username': bot.get('username', ''), 'webhook_active': bool(wh_url)}),
            }
        if qs.get('action') == 'set_webhook':
            func_url = qs.get('url', '')
            if not func_url:
                return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'error': 'url required'})}
            result = tg_api('setWebhook', {
                'url': func_url,
                'allowed_updates': ['message', 'callback_query', 'business_connection',
                                    'business_message', 'edited_business_message'],
            })
            tg_api('setChatMenuButton', {
                'menu_button': {
                    'type': 'web_app',
                    'text': '🚕 Заказать такси',
                    'web_app': {'url': SITE_URL},
                }
            })
            tg_api('deleteMyCommands', {})
            return {'statusCode': 200, 'headers': cors, 'body': json.dumps(result)}
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'ok': True, 'status': 'bot active'})}

    body = json.loads(event.get('body') or '{}')

    bc = body.get('business_connection')
    if bc:
        try:
            conn = psycopg2.connect(os.environ['DATABASE_URL'])
            cur = conn.cursor()
            conn_id = str(bc.get('id', '')).replace("'", "''")
            user = bc.get('user') or {}
            uid = int(user.get('id') or 0)
            uname = str(user.get('username') or '').replace("'", "''")
            is_enabled = bool(bc.get('is_enabled', True))
            can_reply = bool(bc.get('can_reply', False))
            raw = json.dumps(bc).replace("'", "''")
            cur.execute(
                f"INSERT INTO {SCHEMA}.business_connections (connection_id, user_id, username, is_enabled, can_reply, raw) "
                f"VALUES ('{conn_id}', {uid}, '{uname}', {is_enabled}, {can_reply}, '{raw}'::jsonb)"
            )
            conn.commit()
            cur.close()
            conn.close()
        except Exception:
            pass
        return {'statusCode': 200, 'headers': cors, 'body': 'ok'}

    bm = body.get('business_message')
    if bm:
        # Служебка «закрепил(а) сообщение» приходит отдельным апдейтом — сразу стираем её.
        if bm.get('pinned_message'):
            delete_pin_service_message(
                bm.get('business_connection_id', ''),
                (bm.get('chat') or {}).get('id'),
                bm.get('message_id'),
            )
            return {'statusCode': 200, 'headers': cors, 'body': 'ok'}
        greet_business_chat(bm)
        return {'statusCode': 200, 'headers': cors, 'body': 'ok'}

    message = body.get('message')
    if not message:
        return {'statusCode': 200, 'headers': cors, 'body': 'ok'}

    text = message.get('text', '') or ''
    if not text.startswith('/start'):
        return {'statusCode': 200, 'headers': cors, 'body': 'ok'}

    chat_id = message['chat']['id']
    first_name = message.get('from', {}).get('first_name', '')

    if True:
        username = message.get('from', {}).get('username', '')
        try:
            conn = psycopg2.connect(os.environ['DATABASE_URL'])
            cur = conn.cursor()
            cur.execute(f"INSERT INTO {SCHEMA}.sait_bot_users (chat_id, first_name, username) VALUES ({chat_id}, '{first_name}', '{username}') ON CONFLICT (chat_id) DO UPDATE SET first_name = '{first_name}', username = '{username}'")
            conn.commit()
            cur.close()
            conn.close()
        except Exception:
            pass
        tg_api('deleteMessage', {
            'chat_id': chat_id,
            'message_id': message['message_id'],
        })
        tg_api('setChatMenuButton', {
            'chat_id': chat_id,
            'menu_button': {
                'type': 'web_app',
                'text': 'Заказать такси',
                'web_app': {'url': SITE_URL},
            }
        })
        tg_api('sendMessage', {
            'chat_id': chat_id,
            'text': '🚕',
            'reply_markup': {
                'keyboard': [
                    [{'text': '🚕 Заказать такси', 'web_app': {'url': SITE_URL}}],
                ],
                'resize_keyboard': True,
                'is_persistent': True,
                'input_field_placeholder': ' ',
            },
        })

        pinned = tg_api('sendMessage', {
            'chat_id': chat_id,
            'text': PIN_TEXT,
            'parse_mode': 'HTML',
            'reply_markup': {
                'inline_keyboard': [
                    [{'text': '🚕 Заказать такси', 'web_app': {'url': SITE_URL}}],
                ],
            },
        })
        pin_id = (pinned.get('result') or {}).get('message_id')
        if pin_id:
            tg_api('unpinAllChatMessages', {'chat_id': chat_id})
            tg_api('pinChatMessage', {
                'chat_id': chat_id,
                'message_id': pin_id,
                'disable_notification': True,
            })

    return {'statusCode': 200, 'headers': cors, 'body': 'ok'}