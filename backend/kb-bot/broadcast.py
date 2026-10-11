"""Рекламная рассылка подписчикам бота: создание, отправка порциями, история."""
import os
import json
import time
import concurrent.futures
import psycopg2

SCHEMA = 't_p67171637_yug_transfer_prize_l'
AUDIENCES = {
    'all': "TRUE",
    'active': "active_until > now()",
    'expired': "active_until <= now()",
    'driver': "role = 'driver'",
    'dispatcher': "role = 'dispatcher'",
}


def _q(v) -> str:
    return str(v or '').replace("'", "''")


def _where(aud: str) -> str:
    return f"NOT bot_blocked AND ({AUDIENCES.get(aud, 'TRUE')})"


def _row(r) -> dict:
    return {'id': r[0], 'text': r[1], 'photo_url': r[2], 'button_text': r[3], 'button_url': r[4],
            'audience': r[5], 'total': r[6], 'sent': r[7], 'failed': r[8], 'status': r[9],
            'created_at': str(r[10]), 'finished_at': str(r[11]) if r[11] else None}


COLS = "id, text, photo_url, button_text, button_url, audience, total, sent, failed, status, created_at, finished_at"


def overview() -> dict:
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        counts = {}
        for k in AUDIENCES:
            cur.execute(f"SELECT count(*) FROM {SCHEMA}.kb_subscriptions WHERE {_where(k)}")
            counts[k] = cur.fetchone()[0]
        cur.execute(f"SELECT count(*) FROM {SCHEMA}.kb_subscriptions WHERE bot_blocked")
        counts['blocked'] = cur.fetchone()[0]
        cur.execute(f"SELECT {COLS} FROM {SCHEMA}.kb_broadcasts ORDER BY id DESC LIMIT 30")
        items = [_row(r) for r in cur.fetchall()]
        return {'ok': True, 'counts': counts, 'items': items}
    finally:
        cur.close()
        conn.close()


def create(body: dict) -> dict:
    text = str(body.get('text') or '').strip()
    photo = str(body.get('photo_url') or '').strip()
    btn_t = str(body.get('button_text') or '').strip()[:60]
    btn_u = str(body.get('button_url') or '').strip()
    aud = body.get('audience') if body.get('audience') in AUDIENCES else 'all'
    if not text and not photo:
        return {'ok': False, 'error': 'Добавьте текст или картинку'}
    if len(text) > (1000 if photo else 4000):
        return {'ok': False, 'error': 'Текст слишком длинный'}
    if btn_t and not btn_u.startswith(('https://', 'http://', 'tg://')):
        return {'ok': False, 'error': 'Ссылка кнопки должна начинаться с https://'}
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        cur.execute(f"SELECT 1 FROM {SCHEMA}.kb_broadcasts WHERE status='running'")
        if cur.fetchone():
            return {'ok': False, 'error': 'Уже идёт другая рассылка — дождитесь её окончания'}
        cur.execute(f"SELECT count(*) FROM {SCHEMA}.kb_subscriptions WHERE {_where(aud)}")
        total = cur.fetchone()[0]
        if not total:
            return {'ok': False, 'error': 'В выбранной аудитории никого нет'}
        cur.execute(f"INSERT INTO {SCHEMA}.kb_broadcasts (text, photo_url, button_text, button_url, audience, total) "
                    f"VALUES ('{_q(text)}', '{_q(photo)}', '{_q(btn_t)}', '{_q(btn_u)}', '{aud}', {int(total)}) RETURNING id")
        bid = cur.fetchone()[0]
        conn.commit()
        return {'ok': True, 'id': bid, 'total': total}
    finally:
        cur.close()
        conn.close()


def cancel(bid: int) -> dict:
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        cur.execute(f"UPDATE {SCHEMA}.kb_broadcasts SET status='cancelled', finished_at=now() "
                    f"WHERE id={int(bid)} AND status='running'")
        conn.commit()
        return {'ok': True}
    finally:
        cur.close()
        conn.close()


def _payload(b: dict, chat_id: int) -> tuple:
    markup = {'inline_keyboard': [[{'text': b['button_text'], 'url': b['button_url']}]]} if b['button_text'] else None
    if b['photo_url']:
        p = {'chat_id': chat_id, 'photo': b['photo_url'], 'caption': b['text'], 'parse_mode': 'HTML'}
        m = 'sendPhoto'
    else:
        p = {'chat_id': chat_id, 'text': b['text'], 'parse_mode': 'HTML', 'disable_web_page_preview': False}
        m = 'sendMessage'
    if markup:
        p['reply_markup'] = markup
    return m, p


def step(call, deadline: float, test_chat: int = 0) -> dict:
    """Отправляет очередную порцию активной рассылки (до ~25 сообщений в секунду, лимит Telegram — 30)."""
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        cur.execute(f"SELECT {COLS}, cursor_id FROM {SCHEMA}.kb_broadcasts WHERE status='running' ORDER BY id LIMIT 1")
        r = cur.fetchone()
        if not r:
            return {'ok': True, 'idle': True}
        b = _row(r)
        cursor = int(r[12])
        while time.time() < deadline - 2:
            cur.execute(f"SELECT tg_user_id FROM {SCHEMA}.kb_subscriptions WHERE {_where(b['audience'])} "
                        f"AND tg_user_id > {cursor} ORDER BY tg_user_id LIMIT 25")
            ids = [x[0] for x in cur.fetchall()]
            if not ids:
                cur.execute(f"UPDATE {SCHEMA}.kb_broadcasts SET status='done', finished_at=now() WHERE id={b['id']}")
                conn.commit()
                b['status'] = 'done'
                break
            t0 = time.time()
            sent, failed, blocked = 0, 0, []

            def one(uid):
                m, p = _payload(b, uid)
                return uid, call(m, p)

            with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
                for uid, res in pool.map(one, ids):
                    if res.get('ok'):
                        sent += 1
                    else:
                        failed += 1
                        d = str(res.get('description', '')).lower()
                        if 'blocked' in d or 'deactivated' in d or 'chat not found' in d:
                            blocked.append(uid)
            cursor = ids[-1]
            if blocked:
                cur.execute(f"UPDATE {SCHEMA}.kb_subscriptions SET bot_blocked=TRUE "
                            f"WHERE tg_user_id IN ({','.join(str(int(x)) for x in blocked)})")
            cur.execute(f"UPDATE {SCHEMA}.kb_broadcasts SET sent=sent+{sent}, failed=failed+{failed}, "
                        f"cursor_id={int(cursor)} WHERE id={b['id']} AND status='running' RETURNING status")
            alive = cur.fetchone()
            conn.commit()
            b['sent'] += sent
            b['failed'] += failed
            if not alive:
                break
            wait = 1.05 - (time.time() - t0)
            if wait > 0:
                time.sleep(wait)
        return {'ok': True, 'id': b['id'], 'sent': b['sent'], 'failed': b['failed'], 'total': b['total'], 'status': b['status']}
    finally:
        cur.close()
        conn.close()


def send_test(call, body: dict, chat_id: int) -> dict:
    b = {'text': str(body.get('text') or ''), 'photo_url': str(body.get('photo_url') or ''),
         'button_text': str(body.get('button_text') or ''), 'button_url': str(body.get('button_url') or '')}
    m, p = _payload(b, chat_id)
    res = call(m, p)
    return {'ok': bool(res.get('ok')), 'error': res.get('description', '')}


def handle(event: dict, call, deadline: float) -> dict:
    qs = event.get('queryStringParameters') or {}
    method = event.get('httpMethod')
    op = qs.get('op', '')
    body = json.loads(event.get('body') or '{}') if method == 'POST' else {}
    if method == 'GET' and not op:
        return overview()
    if op == 'create':
        return create(body)
    if op == 'cancel':
        return cancel(int(qs.get('id') or body.get('id') or 0))
    if op == 'step':
        return step(call, deadline)
    if op == 'test':
        chat = int(body.get('chat_id') or 0)
        if not chat:
            return {'ok': False, 'error': 'Укажите свой Telegram ID для теста'}
        return send_test(call, body, chat)
    return {'ok': False, 'error': 'unknown op'}
