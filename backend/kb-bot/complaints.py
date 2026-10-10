"""Жалобы на водителей и диспетчеров из бота: пошаговый сбор описания, даты и фото."""
import os
import time
import re
from datetime import date, datetime, timedelta
import psycopg2

SCHEMA = 't_p67171637_yug_transfer_prize_l'
MAX_PHOTOS = 5
NO_AVATAR = 'https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/0ce9fc4b-5704-4dfd-8b7f-595e27e6da6f.jpg'

CANCEL_KB = {'keyboard': [[{'text': '❌ Отменить жалобу'}]], 'resize_keyboard': True}
DATE_KB = {'keyboard': [[{'text': 'Сегодня'}, {'text': 'Вчера'}], [{'text': '❌ Отменить жалобу'}]], 'resize_keyboard': True}
ROLE_KB = {'keyboard': [[{'text': '🚗 Водитель'}, {'text': '🎧 Диспетчер'}], [{'text': '❌ Отменить жалобу'}]],
           'resize_keyboard': True}
ROLE_BY_TEXT = {'🚗 Водитель': 'driver', '🎧 Диспетчер': 'dispatcher', 'водитель': 'driver', 'диспетчер': 'dispatcher'}
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
    start_for(tg_api, user, chat_id, item_id)


def start_for(tg_api, user: dict, chat_id, item_id: int) -> None:
    """Начинает оформление жалобы на карточку item_id."""
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
        need_role = not row[2]
        cur.execute(f"INSERT INTO {SCHEMA}.kb_complaints (item_id, reporter_tg_id, reporter_username, reporter_name, step) "
                    f"VALUES ({item_id}, {int(user['id'])}, '{q(user.get('username'))}', '{q(name)}', "
                    f"'{'role' if need_role else 'text'}')")
        conn.commit()
    finally:
        cur.close()
        conn.close()
    if need_role:
        tg_api('sendMessage', {
            'chat_id': chat_id, 'parse_mode': 'HTML', 'reply_markup': ROLE_KB,
            'text': f"⚠️ <b>Жалоба</b>\n\n{target_info(row, item_id)}\n\n"
                    f"<b>Кто это?</b> Выберите кнопкой ниже: водитель или диспетчер."})
        return
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

    if step == 'role':
        role = ROLE_BY_TEXT.get(msg) or ROLE_BY_TEXT.get(msg.lower())
        if not role:
            tg_api('sendMessage', {'chat_id': chat_id, 'reply_markup': ROLE_KB,
                                   'text': 'Выберите кнопкой: 🚗 Водитель или 🎧 Диспетчер.'})
            return True
        conn = db()
        cur = conn.cursor()
        cur.execute(f"SELECT role FROM {SCHEMA}.check_lists WHERE id={int(item_id or 0)}")
        cr = cur.fetchone()
        if cr is not None and not cr[0]:
            cur.execute(f"INSERT INTO {SCHEMA}.check_list_history (item_id, field, old_value, new_value, source) "
                        f"VALUES ({int(item_id)}, 'role', '', '{role}', 'complaint')")
            cur.execute(f"UPDATE {SCHEMA}.check_lists SET role='{role}', updated_at=now() WHERE id={int(item_id)}")
            conn.commit()
        cur.close()
        conn.close()
        upd("step='text'")
        tg_api('sendMessage', {'chat_id': chat_id, 'parse_mode': 'HTML', 'reply_markup': CANCEL_KB,
                               'text': 'Шаг 1 из 3. Опишите коротко, <b>что произошло</b>.\n'
                                       'Например: «не приехал на заказ, телефон отключил».'})
        return True

    if step == 'text':
        if ROLE_BY_TEXT.get(msg) or ROLE_BY_TEXT.get(msg.lower()) or msg in ('Сегодня', 'Вчера', '✅ Отправить жалобу', '⏭ Без фото'):
            tg_api('sendMessage', {'chat_id': chat_id, 'parse_mode': 'HTML', 'reply_markup': CANCEL_KB,
                                   'text': 'Опишите словами, <b>что произошло</b>.\nНапример: «не приехал на заказ, телефон отключил».'})
            return True
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
            url = store_photo(raw) if raw else ''
            c1 = db()
            k1 = c1.cursor()
            if url:
                # Дописываем фото к уже сохранённым (даже если жалобу успели отправить — фото останется в админке).
                k1.execute(f"UPDATE {SCHEMA}.kb_complaints SET photos=trim(both chr(10) from coalesce(photos,'') || chr(10) || '{q(url)}'), "
                           f"updated_at=now() WHERE id={int(cid)}")
            k1.execute(f"SELECT status, photos FROM {SCHEMA}.kb_complaints WHERE id={int(cid)}")
            st = k1.fetchone() or ('', '')
            c1.commit()
            k1.close()
            c1.close()
            if st[0] != 'draft':
                # Жалобу уже отправили — больше ничего не предлагаем.
                return True
            n = len([p for p in (st[1] or '').split('\n') if p])
            tg_api('sendMessage', {'chat_id': chat_id, 'reply_markup': PHOTO_KB,
                                   'text': f'📎 Фото добавлено ({n}/{MAX_PHOTOS}). Можно ещё или нажмите «✅ Отправить жалобу».'})
            return True
        if msg in ('✅ Отправить жалобу', '⏭ Без фото'):
            # Отправляем только один раз: повторное нажатие или повтор от Telegram ничего не дублирует.
            c0 = db()
            k0 = c0.cursor()
            k0.execute(f"UPDATE {SCHEMA}.kb_complaints SET status='new', step='done', updated_at=now() "
                       f"WHERE id={int(cid)} AND status='draft' RETURNING id")
            first = k0.fetchone()
            c0.commit()
            k0.close()
            c0.close()
            if not first:
                return True
            notify(cid)
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
                                   'disable_web_page_preview': True,
                                   'text': f'✅ <b>Ваша жалоба #{cid} принята</b> и отправлена на модерацию.{info}\n\n'
                                           '⚖️ Решение по жалобе будет опубликовано в группе '
                                           '<a href="https://t.me/chernyi_spisok_transfer">ЧС Авто трансфера РФ</a>.\n'
                                           'О результате мы также напишем вам сюда.'})
            return True
        tg_api('sendMessage', {'chat_id': chat_id, 'reply_markup': PHOTO_KB,
                               'text': 'Пришлите фото или нажмите «✅ Отправить жалобу».'})
        return True
    return False


ADMIN_URL = 'https://ug-transfer.online/posts'
# Решения по жалобам принимаются в группе «ЧС Авто трансфера РФ» (@chernyi_spisok_transfer).
DECISION_CHAT = '-1003740884399'
# Копия жалобы — в тему «жалобы» группы «Заявки юг-трансфер».
COPY_CHAT = '-1002146850254'
COMPLAINTS_THREAD_ID = 10266
CHAT_CANDIDATES = [DECISION_CHAT, COPY_CHAT]


def notify_admin(tg_api, cid: int, to_decision: bool = False) -> None:
    """Новая жалоба уходит в служебную группу администраторов: текст, дата, фото и кнопка в админку."""
    conn = db()
    cur = conn.cursor()
    try:
        cur.execute(f"SELECT k.text, k.incident_date, k.photos, k.reporter_tg_id, k.reporter_username, k.reporter_name, "
                    f"k.created_at, c.name, c.username, c.role, c.list_type, c.tg_id, k.item_id, c.photo_url "
                    f"FROM {SCHEMA}.kb_complaints k LEFT JOIN {SCHEMA}.check_lists c ON c.id = k.item_id WHERE k.id={int(cid)}")
        r = cur.fetchone()
    finally:
        cur.close()
        conn.close()
    if not r:
        return
    text, inc, photos, rep_id, rep_un, rep_name, created, name, un, role, lt, tg_id, item_id, avatar = r
    role_txt = {'driver': '🚗 Водитель', 'dispatcher': '🎧 Диспетчер'}.get(role, '❓ Роль не указана')
    lt_txt = {'white': '✅ белый список', 'black': '⛔️ чёрный список', 'pending': '🕓 на модерации'}.get(lt, '')
    cnt = complaints_count(item_id)
    reporter = f"@{esc(rep_un)}" if rep_un else f'<a href="tg://user?id={rep_id}">{esc(rep_name) or rep_id}</a>'
    lines = [
        f"🚨 <b>Новая жалоба #{cid}</b>",
        "",
        f"На: <b>{esc(name) or 'Без имени'}</b>" + (f" @{esc(un)}" if un else ""),
    ]
    if tg_id:
        lines.append(f"🆔 <code>{tg_id}</code>")
    lines.append(f"{role_txt} · {lt_txt}" if lt_txt else role_txt)
    if cnt > 1:
        lines.append(f"📣 Всего жалоб на него: <b>{cnt}</b>")
    lines += [
        "",
        f"📝 <b>Что произошло:</b>\n{esc(text)[:1500] or '—'}",
        f"📅 <b>Когда:</b> {inc.strftime('%d.%m.%Y') if inc else '—'}",
        f"🙋 <b>Пожаловался:</b> {reporter} (ID <code>{rep_id}</code>)",
    ]
    # В группу ЧС доказательства не отправляем — только аватарка; скриншоты остаются в теме «жалобы» и в админке.
    # Скриншоты-доказательства никуда не отправляем — они только в админке.
    attached = len([p for p in (photos or '').split('\n') if p])
    plist = []
    if attached and not to_decision:
        lines.append(f"📎 Скриншоты: {attached} — смотрите в админке")
    msg = '\n'.join(lines)
    markup = decision_markup(cid, lt) if to_decision else admin_markup(cid, lt, role or '')
    if to_decision:
        msg = msg.replace(f"🚨 <b>Новая жалоба #{cid}</b>", f"⚖️ <b>Жалоба #{cid} — нужно решение</b>")
    # Главное фото — квадратная аватарка (или заглушка): сообщение ровное, кнопки не сжимаются.
    plist_media = [{'type': 'photo', 'media': avatar or NO_AVATAR}] + [{'type': 'photo', 'media': p} for p in plist[:10]]
    sent_ids = {}

    def send_to(chat, thread, with_buttons):
        """Одно сообщение: фото + текст жалобы подписью + кнопки. Остальные фото (если их несколько) — альбомом ответом."""
        caption = msg if len(msg) <= 1024 else msg[:1000].rsplit('\n', 1)[0] + '\n…'
        extra = {'reply_markup': markup} if with_buttons else {}
        first_photo = plist_media[0]['media'] if plist_media else None

        def call(th):
            if first_photo:
                p = {'chat_id': chat, 'photo': first_photo, 'caption': caption, 'parse_mode': 'HTML', **extra}
                method = 'sendPhoto'
            else:
                p = {'chat_id': chat, 'text': msg[:4000], 'parse_mode': 'HTML', 'disable_web_page_preview': True, **extra}
                method = 'sendMessage'
            if th:
                p['message_thread_id'] = th
            return tg_api(method, p)

        c0 = db()
        k0 = c0.cursor()
        k0.execute(f"UPDATE {SCHEMA}.kb_complaints SET send_attempts=send_attempts+1 WHERE id={int(cid)}")
        c0.commit()
        k0.close()
        c0.close()
        res = call(thread)
        if not res:
            # Telegram не ответил — жалобу дошлём позже автоматически (если она так и не появилась в группе).
            print(f"[KB-BOT] complaint #{cid} to {chat}: no answer from Telegram, will retry later")
            return None
        if not res.get('ok') and first_photo and first_photo != NO_AVATAR:
            print(f"[KB-BOT] complaint avatar failed: {res.get('description', '')[:120]}")
            first_photo = NO_AVATAR
            res = call(thread)
        if res and not res.get('ok') and first_photo:
            print(f"[KB-BOT] complaint photo failed: {res.get('description', '')[:120]}")
            first_photo = None
            res = call(thread)
        if not res.get('ok'):
            print(f"[KB-BOT] complaint to {chat} failed: {res.get('description', '')[:120]}")
            return None
        msg_id = (res.get('result') or {}).get('message_id')
        sent_ids.setdefault(str(chat), []).append(msg_id)
        rest = plist_media[1:]
        if rest:
            mg = {'chat_id': chat, 'media': [dict(m) for m in rest],
                  'reply_parameters': {'message_id': msg_id, 'allow_sending_without_reply': True}}
            if thread:
                mg['message_thread_id'] = thread
            if len(rest) == 1:
                one = {k: v for k, v in mg.items() if k != 'media'}
                one['photo'] = rest[0]['media']
                album = tg_api('sendPhoto', one)
                res_list = [album.get('result')] if album.get('result') else []
            else:
                album = tg_api('sendMediaGroup', mg)
                res_list = album.get('result') or []
            for m in res_list:
                sent_ids[str(chat)].append(m.get('message_id'))
        return msg_id

    # Новая жалоба — только в тему «жалобы» (уведомление с кнопками).
    # В группу ЧС попадает лишь итоговая карточка — после решения администратора.
    if to_decision:
        target_chat = os.environ.get('KB_COMPLAINTS_CHAT_ID', '').strip() or DECISION_CHAT
        msg_id = send_to(target_chat, None, True)
    else:
        target_chat = COPY_CHAT
        msg_id = send_to(COPY_CHAT, COMPLAINTS_THREAD_ID, True)
    if msg_id:
        c2 = db()
        k2 = c2.cursor()
        ids = ','.join(str(i) for i in sent_ids.get(str(target_chat), []) if i)
        k2.execute(f"UPDATE {SCHEMA}.kb_complaints SET group_chat='{q(target_chat)}', group_msg_id={int(msg_id)}, "
                   f"group_msgs='{q(target_chat)}|{ids}' WHERE id={int(cid)}")
        c2.commit()
        k2.close()
        c2.close()
        print(f'[KB-BOT] complaint #{cid} sent to {target_chat}')


def retry_unsent(tg_api) -> int:
    """Дошлёт в тему «Жалобы» жалобы, которые не ушли из-за сбоя связи с Telegram (до 3 попыток)."""
    conn = db()
    cur = conn.cursor()
    cur.execute(f"SELECT id FROM {SCHEMA}.kb_complaints WHERE status='new' AND group_msg_id IS NULL "
                f"AND coalesce(group_msgs,'')='' AND send_attempts < 3 AND updated_at < now() - interval '40 seconds' "
                f"ORDER BY id LIMIT 1")
    r = cur.fetchone()
    cur.close()
    conn.close()
    if not r:
        return 0
    notify_admin(tg_api, int(r[0]))
    return int(r[0])


def decision_markup(cid: int, list_type: str = '') -> dict:
    """Кнопки в группе ЧС: только решение."""
    first = '⛔️ Подтвердить (уже в ЧС)' if list_type == 'black' else '⛔️ Заносим в ЧС'
    return {'inline_keyboard': [[{'text': first, 'callback_data': f'cblack:{int(cid)}'}],
                                [{'text': '✖️ Жалоба не обоснована', 'callback_data': f'creject:{int(cid)}'}]]}


def admin_markup(cid: int, list_type: str = '', role: str = '') -> dict:
    """Кнопки решения по жалобе: отправить в группу ЧС или отклонить."""
    rows = []
    rows.append([{'text': '📤 Отправить в группу ЧС', 'callback_data': f'csend:{int(cid)}'}])
    rows.append([{'text': '✖️ Не обоснована', 'callback_data': f'creject:{int(cid)}'}])
    return {'inline_keyboard': rows}


def handle_role_button(tg_api, callback: dict) -> None:
    """Админ группы присваивает роль аккаунту из жалобы (водитель / диспетчер)."""
    user = callback.get('from') or {}
    msg = callback.get('message') or {}
    chat_id = (msg.get('chat') or {}).get('id')
    _, cid, role = str(callback.get('data', '')).split(':')
    if not is_group_admin(tg_api, chat_id, user.get('id')):
        tg_api('answerCallbackQuery', {'callback_query_id': callback.get('id'), 'show_alert': True,
                                       'text': 'Роль присваивает только администратор группы.'}, timeout=2.2)
        return
    conn = db()
    cur = conn.cursor()
    try:
        cur.execute(f"SELECT c.id, c.role, c.list_type FROM {SCHEMA}.kb_complaints k JOIN {SCHEMA}.check_lists c "
                    f"ON c.id = k.item_id WHERE k.id={int(cid)}")
        r = cur.fetchone()
        if not r:
            tg_api('answerCallbackQuery', {'callback_query_id': callback.get('id'), 'text': 'Аккаунт не найден'}, timeout=2.2)
            return
        if r[1] != role:
            cur.execute(f"INSERT INTO {SCHEMA}.check_list_history (item_id, field, old_value, new_value, source) "
                        f"VALUES ({int(r[0])}, 'role', '{q(r[1])}', '{q(role)}', 'complaint')")
            cur.execute(f"UPDATE {SCHEMA}.check_lists SET role='{q(role)}', updated_at=now() WHERE id={int(r[0])}")
            conn.commit()
    finally:
        cur.close()
        conn.close()
    label = 'Водитель' if role == 'driver' else 'Диспетчер'
    tg_api('answerCallbackQuery', {'callback_query_id': callback.get('id'), 'text': f'Роль: {label}'}, timeout=2.2)
    tg_api('editMessageReplyMarkup', {'chat_id': chat_id, 'message_id': msg.get('message_id'),
                                      'reply_markup': admin_markup(int(cid), r[2], role)}, timeout=3)


def is_group_admin(tg_api, chat_id, user_id) -> bool:
    res = tg_api('getChatMember', {'chat_id': chat_id, 'user_id': user_id}, timeout=3)
    return (res.get('result') or {}).get('status') in ('administrator', 'creator')


def to_black(cid: int, by: str) -> str:
    """Принимает жалобу и переносит аккаунт в чёрный список. Возвращает итог для кнопки."""
    conn = db()
    cur = conn.cursor()
    try:
        cur.execute(f"SELECT item_id, text, incident_date, status FROM {SCHEMA}.kb_complaints WHERE id={int(cid)}")
        k = cur.fetchone()
        if not k:
            return 'Жалоба не найдена'
        item_id, text, inc, status = k
        cur.execute(f"SELECT list_type, role, reason, name FROM {SCHEMA}.check_lists WHERE id={int(item_id or 0)}")
        c = cur.fetchone()
        if not c:
            return 'Аккаунт не найден в базе'
        if c[0] == 'black':
            cur.execute(f"UPDATE {SCHEMA}.kb_complaints SET status='accepted', admin_note='{q(by)}', updated_at=now() "
                        f"WHERE id={int(cid)} AND status='new'")
            conn.commit()
            return 'Аккаунт уже в чёрном списке'
        role = c[1] or 'driver'
        reason = ((c[2] + '\n') if c[2] else '') + (text or '')
        for field, old, new in (('list_type', c[0], 'black'), ('role', c[1], role)):
            if old != new:
                cur.execute(f"INSERT INTO {SCHEMA}.check_list_history (item_id, field, old_value, new_value, source) "
                            f"VALUES ({int(item_id)}, '{field}', '{q(old)}', '{q(new)}', 'complaint')")
        removed = f"'{inc.isoformat()}'" if inc else 'CURRENT_DATE'
        cur.execute(f"UPDATE {SCHEMA}.check_lists SET list_type='black', role='{role}', reason='{q(reason[:3000])}', "
                    f"removed_at={removed}, updated_at=now() WHERE id={int(item_id)}")
        cur.execute(f"UPDATE {SCHEMA}.kb_complaints SET status='accepted', admin_note='{q('В ЧС из группы: ' + by)}', "
                    f"updated_at=now() WHERE id={int(cid)}")
        conn.commit()
        return f"⛔️ {c[3] or 'Аккаунт'} отправлен в чёрный список"
    finally:
        cur.close()
        conn.close()


def handle_black_button(tg_api, callback: dict) -> None:
    user = callback.get('from') or {}
    msg = callback.get('message') or {}
    chat_id = (msg.get('chat') or {}).get('id')
    cid = int(str(callback.get('data', '')).split(':')[1])
    if not is_group_admin(tg_api, chat_id, user.get('id')):
        tg_api('answerCallbackQuery', {'callback_query_id': callback.get('id'), 'show_alert': True,
                                       'text': 'Заносить в ЧС может только администратор группы.'}, timeout=2.2)
        return
    by = f"@{user['username']}" if user.get('username') else (user.get('first_name') or str(user.get('id')))
    conn = db()
    cur = conn.cursor()
    cur.execute(f"SELECT c.role FROM {SCHEMA}.kb_complaints k JOIN {SCHEMA}.check_lists c ON c.id=k.item_id WHERE k.id={int(cid)}")
    rr = cur.fetchone()
    cur.close()
    conn.close()
    if rr is not None and not rr[0]:
        tg_api('answerCallbackQuery', {'callback_query_id': callback.get('id'), 'show_alert': True,
                                       'text': 'Сначала выберите роль: 🚗 Водитель или 🎧 Диспетчер.'}, timeout=2.2)
        return
    result = to_black(cid, by)
    tg_api('answerCallbackQuery', {'callback_query_id': callback.get('id'), 'text': result[:190]}, timeout=2.2)
    if 'не найден' in result:
        return
    publish_verdict(tg_api, cid, by)
    notify_reporter(tg_api, cid)


def notify_reporter(tg_api, cid: int) -> None:
    """Пишет автору жалобы в личку о решении (один раз)."""
    conn = db()
    cur = conn.cursor()
    try:
        cur.execute(f"SELECT k.reporter_tg_id, k.status, k.reporter_notified, c.name, c.username, k.created_at "
                    f"FROM {SCHEMA}.kb_complaints k LEFT JOIN {SCHEMA}.check_lists c ON c.id = k.item_id WHERE k.id={int(cid)}")
        r = cur.fetchone()
        if not r or r[2] or r[1] not in ('accepted', 'rejected'):
            return
        rep, status, _, name, un, created = r
        who = (esc(name) or 'аккаунт') + (f" (@{esc(un)})" if un else '')
        when = created.strftime('%d.%m.%Y') if created else ''
        if status == 'accepted':
            text = (f"✅ <b>Ваша жалоба #{cid} рассмотрена</b>\n\n"
                    f"Жалоба от {when} на {who} подтверждена.\n⛔️ Аккаунт отправлен в <b>чёрный список</b>.\n\n"
                    f"Спасибо, что помогаете делать работу безопаснее!")
        else:
            text = (f"ℹ️ <b>Ваша жалоба #{cid} рассмотрена</b>\n\n"
                    f"Жалоба от {when} на {who} признана <b>необоснованной</b> — информация не подтвердилась.\n\n"
                    f"Если у вас есть новые доказательства, отправьте жалобу повторно.")
        res = tg_api('sendMessage', {'chat_id': rep, 'text': text, 'parse_mode': 'HTML'}, timeout=3)
        cur.execute(f"UPDATE {SCHEMA}.kb_complaints SET reporter_notified=TRUE WHERE id={int(cid)}")
        conn.commit()
        if not res.get('ok'):
            print(f"[KB-BOT] reporter notify failed: {res.get('description', '')[:100]}")
    finally:
        cur.close()
        conn.close()


def mark_group_message(tg_api, cid: int, label: str) -> None:
    """Меняет кнопки под уведомлением в группе на итог решения."""
    conn = db()
    cur = conn.cursor()
    cur.execute(f"SELECT group_chat, group_msg_id FROM {SCHEMA}.kb_complaints WHERE id={int(cid)}")
    r = cur.fetchone()
    cur.close()
    conn.close()
    if not r or not r[0] or not r[1]:
        return
    tg_api('editMessageReplyMarkup', {
        'chat_id': r[0], 'message_id': r[1],
        'reply_markup': {'inline_keyboard': [[{'text': label, 'callback_data': 'noop'}]]}}, timeout=3)


def reject(cid: int, by: str) -> str:
    conn = db()
    cur = conn.cursor()
    try:
        cur.execute(f"UPDATE {SCHEMA}.kb_complaints SET status='rejected', admin_note='{q('Отклонена: ' + by)}', "
                    f"updated_at=now() WHERE id={int(cid)} AND status='new' RETURNING id")
        ok = cur.fetchone()
        conn.commit()
        return '✖️ Жалоба признана необоснованной' if ok else 'Жалоба уже обработана'
    finally:
        cur.close()
        conn.close()


def handle_reject_button(tg_api, callback: dict) -> None:
    user = callback.get('from') or {}
    msg = callback.get('message') or {}
    chat_id = (msg.get('chat') or {}).get('id')
    cid = int(str(callback.get('data', '')).split(':')[1])
    if not is_group_admin(tg_api, chat_id, user.get('id')):
        tg_api('answerCallbackQuery', {'callback_query_id': callback.get('id'), 'show_alert': True,
                                       'text': 'Решение по жалобе принимает только администратор группы.'}, timeout=2.2)
        return
    by = f"@{user['username']}" if user.get('username') else (user.get('first_name') or str(user.get('id')))
    result = reject(cid, by)
    tg_api('answerCallbackQuery', {'callback_query_id': callback.get('id'), 'text': result}, timeout=2.2)
    if result.startswith('✖️'):
        delete_group_messages(tg_api, cid)
        notify_reporter(tg_api, cid)


def delete_group_messages(tg_api, cid: int) -> None:
    """Удаляет из группы решений все сообщения по жалобе (текст и фото)."""
    conn = db()
    cur = conn.cursor()
    cur.execute(f"SELECT group_msgs, group_chat, group_msg_id FROM {SCHEMA}.kb_complaints WHERE id={int(cid)}")
    r = cur.fetchone()
    if not r:
        cur.close()
        conn.close()
        return
    chat, _, ids = (r[0] or '').partition('|')
    id_list = [int(x) for x in ids.split(',') if x.strip().isdigit()]
    if not chat and r[1] and r[2]:
        chat, id_list = r[1], [int(r[2])]
    if chat and id_list:
        res = tg_api('deleteMessages', {'chat_id': chat, 'message_ids': id_list}, timeout=4)
        if not res.get('ok'):
            for mid in id_list:
                tg_api('deleteMessage', {'chat_id': chat, 'message_id': mid}, timeout=3)
    cur.execute(f"UPDATE {SCHEMA}.kb_complaints SET group_msgs='', group_msg_id=NULL WHERE id={int(cid)}")
    conn.commit()
    cur.close()
    conn.close()


def publish_verdict(tg_api, cid: int, by: str) -> None:
    """После решения «в ЧС»: убираем сообщение с кнопками и публикуем итоговую карточку в группе ЧС."""
    conn = db()
    cur = conn.cursor()
    cur.execute(f"SELECT k.text, k.incident_date, k.photos, c.name, c.username, c.role, c.tg_id, c.phone, c.photo_url, k.item_id "
                f"FROM {SCHEMA}.kb_complaints k LEFT JOIN {SCHEMA}.check_lists c ON c.id = k.item_id WHERE k.id={int(cid)}")
    r = cur.fetchone()
    cur.close()
    conn.close()
    if not r:
        return
    text, inc, photos, name, un, role, tg_id, phone, avatar, item_id = r
    c2 = db()
    k2 = c2.cursor()
    k2.execute(f"SELECT group_chat, group_msg_id FROM {SCHEMA}.kb_complaints WHERE id={int(cid)}")
    g = k2.fetchone() or ('', None)
    k2.close()
    c2.close()
    if g[0] and str(g[0]) != COPY_CHAT and g[1]:
        # Пост с жалобой в группе ЧС остаётся — убираем только кнопки решения.
        res = tg_api('editMessageReplyMarkup', {'chat_id': g[0], 'message_id': int(g[1]),
                                                'reply_markup': {'inline_keyboard': []}}, timeout=3)
        if res.get('ok') or 'not modified' in str(res.get('description', '')):
            return
        print(f"[KB-BOT] verdict buttons remove failed: {str(res.get('description', ''))[:120]}")
        return
    delete_group_messages(tg_api, cid)
    role_txt = {'driver': '🚗 Водитель', 'dispatcher': '🎧 Диспетчер'}.get(role, '👤 Участник')
    lines = ["⛔️ <b>ЗАНЕСЁН В ЧЁРНЫЙ СПИСОК</b>", "",
             f"{role_txt}: <b>{esc(name) or 'Без имени'}</b>"]
    if un:
        lines.append(f"🔗 @{esc(un)}")
    if tg_id:
        lines.append(f"🆔 <code>{tg_id}</code>")
    if phone:
        lines.append(f"📞 {esc(phone)}")
    lines += ["", f"❗️ <b>За что:</b> {esc(text)[:700]}"]
    if inc:
        lines.append(f"📅 <b>Когда:</b> {inc.strftime('%d.%m.%Y')}")
    cnt = complaints_count(item_id)
    if cnt > 1:
        lines.append(f"📣 Жалоб на него: <b>{cnt}</b>")
    lines += ["", "⚠️ Не работайте с этим аккаунтом!", f"<i>Решение: {esc(by)}</i>"]
    caption = '\n'.join(lines)[:1024]
    chat = DECISION_CHAT
    plist = [p for p in (photos or '').split('\n') if p]
    media_urls = [avatar or NO_AVATAR]
    if len(media_urls) > 1:
        media = [{'type': 'photo', 'media': u} for u in media_urls[:10]]
        media[0]['caption'] = caption
        media[0]['parse_mode'] = 'HTML'
        res = tg_api('sendMediaGroup', {'chat_id': chat, 'media': media})
    elif media_urls:
        res = tg_api('sendPhoto', {'chat_id': chat, 'photo': media_urls[0], 'caption': caption, 'parse_mode': 'HTML'})
    else:
        res = tg_api('sendMessage', {'chat_id': chat, 'text': caption, 'parse_mode': 'HTML'})
    if not res.get('ok'):
        print(f"[KB-BOT] verdict publish failed: {res.get('description', '')[:120]}")


def send_to_decision(tg_api, cid: int) -> dict:
    """Переносит жалобу на решение в группу ЧС: уведомление в теме помечается, в ЧС уходит сообщение с 2 кнопками."""
    conn = db()
    cur = conn.cursor()
    cur.execute(f"SELECT k.group_chat, c.role, k.status FROM {SCHEMA}.kb_complaints k "
                f"LEFT JOIN {SCHEMA}.check_lists c ON c.id=k.item_id WHERE k.id={int(cid)}")
    pr = cur.fetchone() or ('', '', '')
    cur.close()
    conn.close()
    if pr[2] != 'new':
        return {'ok': False, 'error': 'Жалоба уже рассмотрена'}
    if not pr[1]:
        return {'ok': False, 'error': 'Сначала выберите роль: водитель или диспетчер'}
    if pr[0] == COPY_CHAT:
        mark_group_message(tg_api, cid, '📤 Отправлено в группу ЧС на решение')
    else:
        delete_group_messages(tg_api, cid)
    notify_admin(tg_api, cid, to_decision=True)
    conn = db()
    cur = conn.cursor()
    cur.execute(f"SELECT group_chat, group_msg_id FROM {SCHEMA}.kb_complaints WHERE id={int(cid)}")
    r = cur.fetchone() or ('', None)
    cur.close()
    conn.close()
    ok = bool(r[1]) and r[0] != COPY_CHAT
    return {'ok': ok, 'where': 'группу «ЧС Авто трансфера РФ»' if ok else '',
            'error': '' if ok else 'Бот не смог отправить — добавьте его админом в группу ЧС'}


def handle_send_button(tg_api, callback: dict) -> None:
    user = callback.get('from') or {}
    chat_id = ((callback.get('message') or {}).get('chat') or {}).get('id')
    cid = int(str(callback.get('data', '')).split(':')[1])
    if not is_group_admin(tg_api, chat_id, user.get('id')):
        tg_api('answerCallbackQuery', {'callback_query_id': callback.get('id'), 'show_alert': True,
                                       'text': 'Отправлять в ЧС может только администратор группы.'}, timeout=2.2)
        return
    res = send_to_decision(tg_api, cid)
    tg_api('answerCallbackQuery', {'callback_query_id': callback.get('id'), 'show_alert': not res['ok'],
                                   'text': ('📤 Отправлено в группу ЧС на решение' if res['ok'] else res['error'])[:190]},
           timeout=2.2)
