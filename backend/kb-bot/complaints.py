"""Жалобы на водителей и диспетчеров из бота: пошаговый сбор описания, даты и фото."""
import os
import re
from datetime import date, datetime, timedelta
import psycopg2

SCHEMA = 't_p67171637_yug_transfer_prize_l'
MAX_PHOTOS = 5

CANCEL_KB = {'keyboard': [[{'text': '❌ Отменить жалобу'}]], 'resize_keyboard': True}
DATE_KB = {'keyboard': [[{'text': 'Сегодня'}, {'text': 'Вчера'}], [{'text': '❌ Отменить жалобу'}]], 'resize_keyboard': True}
PHOTO_KB = {'keyboard': [[{'text': '✅ Отправить жалобу'}], [{'text': '⏭ Без фото'}], [{'text': '❌ Отменить жалобу'}]],
            'resize_keyboard': True}


def q(v) -> str:
    return str(v or '').replace("'", "''")


def db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def complain_button(item_id) -> dict:
    return {'inline_keyboard': [[{'text': '⚠️ Пожаловаться', 'callback_data': f'complain:{int(item_id)}'}]]}


def active_draft(user_id: int):
    conn = db()
    cur = conn.cursor()
    try:
        cur.execute(f"SELECT id, item_id, step, text, incident_date, photos FROM {SCHEMA}.kb_complaints "
                    f"WHERE reporter_tg_id={int(user_id)} AND status='draft' "
                    f"AND updated_at > now() - interval '2 hours' ORDER BY id DESC LIMIT 1")
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def start(tg_api, callback: dict) -> None:
    user = callback.get('from') or {}
    chat_id = ((callback.get('message') or {}).get('chat') or {}).get('id') or user.get('id')
    item_id = int(str(callback.get('data', '')).split(':')[1])
    tg_api('answerCallbackQuery', {'callback_query_id': callback.get('id')}, timeout=2.2)
    conn = db()
    cur = conn.cursor()
    try:
        cur.execute(f"SELECT name, username, role, list_type, tg_id FROM {SCHEMA}.check_lists WHERE id={item_id}")
        row = cur.fetchone()
        if not row:
            tg_api('sendMessage', {'chat_id': chat_id, 'text': 'Карточка не найдена.'})
            return
        cur.execute(f"UPDATE {SCHEMA}.kb_complaints SET status='cancelled' "
                    f"WHERE reporter_tg_id={int(user['id'])} AND status='draft'")
        name = ' '.join(x for x in [user.get('first_name', ''), user.get('last_name', '')] if x).strip()
        cur.execute(f"INSERT INTO {SCHEMA}.kb_complaints (item_id, reporter_tg_id, reporter_username, reporter_name) "
                    f"VALUES ({item_id}, {int(user['id'])}, '{q(user.get('username'))}', '{q(name)}')")
        conn.commit()
    finally:
        cur.close()
        conn.close()
    tg_api('sendMessage', {
        'chat_id': chat_id, 'parse_mode': 'HTML', 'reply_markup': CANCEL_KB,
        'text': f"⚠️ <b>Жалоба</b>\n\n{target_info(row, item_id)}\n\n"
                f"Шаг 1 из 3. Опишите коротко, <b>что произошло</b>.\n"
                f"Например: «не приехал на заказ, телефон отключил»."})


def esc(s) -> str:
    return str(s or '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def complaints_count(item_id) -> int:
    conn = db()
    cur = conn.cursor()
    try:
        cur.execute(f"SELECT count(*) FROM {SCHEMA}.kb_complaints WHERE item_id={int(item_id or 0)} "
                    f"AND status IN ('new', 'accepted')")
        return cur.fetchone()[0]
    finally:
        cur.close()
        conn.close()


def target_info(row, item_id) -> str:
    """Кто это по нашей базе: роль и статус. Статус меняет только администратор."""
    name, username, role, list_type, tg_id = row
    role_txt = {'driver': '🚗 Водитель', 'dispatcher': '🎧 Диспетчер'}.get(role, '👤 Роль не определена')
    status_txt = {'white': '✅ в белом списке', 'black': '⛔️ в ЧЁРНОМ списке',
                  'pending': '🕓 на проверке у модераторов'}.get(list_type, '')
    lines = [f"На: <b>{esc(name) or 'Без имени'}</b>"]
    if username:
        lines.append(f"🔗 @{esc(username)}")
    if tg_id:
        lines.append(f"🆔 <code>{tg_id}</code>")
    lines.append(f"{role_txt} · {status_txt}" if status_txt else role_txt)
    cnt = complaints_count(item_id)
    if cnt:
        lines.append(f"📣 Жалоб уже поступило: <b>{cnt}</b>")
    if list_type == 'black':
        lines.append("\nℹ️ Аккаунт уже в чёрном списке. Ваша жалоба будет добавлена к его истории.")
    else:
        lines.append("\nℹ️ Статус меняет только администратор после проверки жалобы.")
    return '\n'.join(lines)


def parse_date(text: str):
    t = text.strip().lower()
    if t == 'сегодня':
        return date.today()
    if t == 'вчера':
        return date.today() - timedelta(days=1)
    m = re.match(r'^(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{2,4}))?$', t)
    if not m:
        return None
    d, mo, y = int(m.group(1)), int(m.group(2)), m.group(3)
    year = int(y) + (2000 if y and len(y) == 2 else 0) if y else date.today().year
    try:
        res = date(year, mo, d)
    except ValueError:
        return None
    return res if res <= date.today() else None


def handle_message(tg_api, tg_download, store_photo, message: dict, main_kb: dict, notify) -> bool:
    """Возвращает True, если сообщение относилось к оформлению жалобы."""
    user = message.get('from') or {}
    chat_id = (message.get('chat') or {}).get('id')
    draft = active_draft(user.get('id') or 0)
    if not draft:
        return False
    cid, item_id, step, text, inc_date, photos = draft
    msg = (message.get('text') or message.get('caption') or '').strip()

    def upd(sets: str):
        conn = db()
        cur = conn.cursor()
        cur.execute(f"UPDATE {SCHEMA}.kb_complaints SET {sets}, updated_at=now() WHERE id={cid}")
        conn.commit()
        cur.close()
        conn.close()

    if msg == '❌ Отменить жалобу' or msg.lower() == '/start':
        upd("status='cancelled'")
        tg_api('sendMessage', {'chat_id': chat_id, 'text': 'Жалоба отменена.', 'reply_markup': main_kb})
        return msg != '/start'

    if step == 'text':
        if len(msg) < 5:
            tg_api('sendMessage', {'chat_id': chat_id, 'text': 'Опишите ситуацию чуть подробнее (хотя бы одно предложение).',
                                   'reply_markup': CANCEL_KB})
            return True
        upd(f"text='{q(msg[:2000])}', step='date'")
        tg_api('sendMessage', {'chat_id': chat_id, 'parse_mode': 'HTML', 'reply_markup': DATE_KB,
                               'text': 'Шаг 2 из 3. <b>Когда это было?</b>\nНажмите кнопку или напишите дату, например 05.10.2026'})
        return True

    if step == 'date':
        d = parse_date(msg)
        if not d:
            tg_api('sendMessage', {'chat_id': chat_id, 'reply_markup': DATE_KB,
                                   'text': 'Не понял дату. Напишите в формате ДД.ММ.ГГГГ, например 05.10.2026'})
            return True
        upd(f"incident_date='{d.isoformat()}', step='photos'")
        tg_api('sendMessage', {'chat_id': chat_id, 'parse_mode': 'HTML', 'reply_markup': PHOTO_KB,
                               'text': f'Шаг 3 из 3. <b>Прикрепите фото</b> — скриншоты переписки, чеки и т.п. (до {MAX_PHOTOS} шт.).\n'
                                       'Когда закончите — нажмите «✅ Отправить жалобу».'})
        return True

    if step == 'photos':
        plist = [p for p in (photos or '').split('\n') if p]
        if message.get('photo'):
            if len(plist) >= MAX_PHOTOS:
                tg_api('sendMessage', {'chat_id': chat_id, 'text': f'Можно не больше {MAX_PHOTOS} фото. Нажмите «✅ Отправить жалобу».',
                                       'reply_markup': PHOTO_KB})
                return True
            raw = tg_download(message['photo'][-1]['file_id'])
            if raw:
                plist.append(store_photo(raw))
                upd(f"photos='{q(chr(10).join(plist))}'")
            tg_api('sendMessage', {'chat_id': chat_id, 'reply_markup': PHOTO_KB,
                                   'text': f'📎 Фото добавлено ({len(plist)}/{MAX_PHOTOS}). Можно ещё или нажмите «✅ Отправить жалобу».'})
            return True
        if msg in ('✅ Отправить жалобу', '⏭ Без фото'):
            upd("status='new', step='done'")
            info = ''
            conn = db()
            cur = conn.cursor()
            cur.execute(f"SELECT name, username, role, list_type, tg_id FROM {SCHEMA}.check_lists WHERE id={int(item_id or 0)}")
            row = cur.fetchone()
            cur.close()
            conn.close()
            if row:
                info = '\n\n' + target_info(row, item_id).split('\n\nℹ️')[0]
            tg_api('sendMessage', {'chat_id': chat_id, 'reply_markup': main_kb, 'parse_mode': 'HTML',
                                   'text': f'✅ <b>Жалоба отправлена.</b>{info}\n\nСпасибо! Администратор проверит информацию и примет решение.'})
            notify(cid)
            return True
        tg_api('sendMessage', {'chat_id': chat_id, 'reply_markup': PHOTO_KB,
                               'text': 'Пришлите фото или нажмите «✅ Отправить жалобу».'})
        return True
    return False
