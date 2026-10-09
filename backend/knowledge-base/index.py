"""
База знаний для раздела «Посты в канал».
GET — список статей. POST — создать. PUT — обновить. DELETE ?id= — удалить.
?entity=lists — то же для белых/чёрных списков водителей и диспетчеров.
"""
import os
import json
import hashlib
import base64
import uuid
import boto3
import psycopg2

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
}
SCHEMA = 't_p67171637_yug_transfer_prize_l'


def verify_token(token: str) -> bool:
    if not token:
        return False
    a = hashlib.sha256(f"{os.environ.get('ADMIN_LOGIN', '')}:{os.environ.get('ADMIN_PASSWORD', '')}:admin_secret_2026".encode()).hexdigest()
    pl = os.environ.get('POSTS_LOGIN', '')
    p = hashlib.sha256(f"{pl}:{os.environ.get('POSTS_PASSWORD', '')}:posts_secret_2026".encode()).hexdigest()
    return token == a or (bool(pl) and token == p)


def resp(code: int, data: dict) -> dict:
    return {'statusCode': code, 'headers': {**CORS, 'Content-Type': 'application/json'},
            'body': json.dumps(data, ensure_ascii=False, default=str)}


def esc(v) -> str:
    return str(v or '').replace("'", "''")


ROLES = ('driver', 'dispatcher')
LIST_TYPES = ('white', 'black')


def clean_phone(v) -> str:
    return ''.join(ch for ch in str(v or '') if ch.isdigit() or ch == '+')


def parse_tg_id(v):
    digits = ''.join(ch for ch in str(v or '') if ch.isdigit())
    return int(digits) if digits and len(digits) <= 15 else None


def resolve_tg(cur, tg_id, username: str):
    """Ищет аккаунт в справочнике Telegram-пользователей по ID или @username."""
    if tg_id:
        cur.execute(f"SELECT tg_id, username, trim(first_name || ' ' || last_name) FROM {SCHEMA}.tg_users WHERE tg_id={int(tg_id)}")
    elif username:
        cur.execute(f"SELECT tg_id, username, trim(first_name || ' ' || last_name) FROM {SCHEMA}.tg_users "
                    f"WHERE lower(username)=lower('{esc(username)}') ORDER BY updated_at DESC LIMIT 1")
    else:
        return None
    return cur.fetchone()


def handle_lookup(cur, qs: dict) -> dict:
    q = str(qs.get('q') or '').strip().lstrip('@')
    row = resolve_tg(cur, parse_tg_id(q) if q.isdigit() else None, '' if q.isdigit() else q)
    if not row:
        return resp(200, {'ok': True, 'found': False})
    return resp(200, {'ok': True, 'found': True, 'tg_id': row[0], 'username': row[1], 'name': row[2]})


LIST_FIELDS = "id, role, list_type, name, username, phone, note, created_at, tg_id, photo_url, bio, reason, removed_at, last_scan_at, scan_status, updated_at"
FIELD_LABELS = {'name': 'Имя', 'username': 'Username', 'phone': 'Телефон', 'tg_id': 'Telegram ID',
                'note': 'Комментарий', 'reason': 'Причина', 'removed_at': 'Дата удаления',
                'photo_url': 'Фото', 'list_type': 'Список', 'role': 'Роль'}


def row_to_item(r) -> dict:
    keys = [k.strip() for k in LIST_FIELDS.split(',')]
    return dict(zip(keys, r))


def parse_date(v):
    v = str(v or '').strip()[:10]
    if len(v) == 10 and v[4] == '-' and v[7] == '-' and v.replace('-', '').isdigit():
        return v
    return None


def upload_photo(body: dict) -> dict:
    data = body.get('file') or ''
    if ',' in data:
        data = data.split(',', 1)[1]
    raw = base64.b64decode(data)
    ctype = body.get('content_type') or 'image/jpeg'
    ext = {'image/png': 'png', 'image/webp': 'webp'}.get(ctype, 'jpg')
    key = f"check-lists/{uuid.uuid4().hex}.{ext}"
    s3 = boto3.client('s3', endpoint_url='https://bucket.poehali.dev',
                      aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
                      aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'])
    s3.put_object(Bucket='files', Key=key, Body=raw, ContentType=ctype)
    url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
    return resp(200, {'ok': True, 'url': url})


def handle_history(cur, qs: dict) -> dict:
    item_id = int(qs.get('id') or 0)
    cur.execute(f"SELECT field, old_value, new_value, source, changed_at FROM {SCHEMA}.check_list_history "
                f"WHERE item_id={item_id} ORDER BY changed_at DESC, id DESC LIMIT 200")
    items = [{'field': r[0], 'label': FIELD_LABELS.get(r[0], r[0]), 'old': r[1], 'new': r[2],
              'source': r[3], 'changed_at': r[4]} for r in cur.fetchall()]
    return resp(200, {'ok': True, 'items': items})


def handle_subs_stats(cur, qs: dict) -> dict:
    month = str(qs.get('month') or '')[:7]
    if not (len(month) == 7 and month[4] == '-' and month.replace('-', '').isdigit()):
        cur.execute("SELECT to_char(now(), 'YYYY-MM')")
        month = cur.fetchone()[0]
    m_start = f"'{month}-01'::date"
    m_end = f"('{month}-01'::date + interval '1 month')"

    cur.execute(f"SELECT count(*), coalesce(sum(amount_rub), 0), count(DISTINCT tg_user_id) "
                f"FROM {SCHEMA}.payment_log WHERE kind='subscription' "
                f"AND created_at >= {m_start} AND created_at < {m_end}")
    m_cnt, m_sum, m_users = cur.fetchone()

    cur.execute(f"SELECT count(*), coalesce(sum(amount_rub), 0) FROM {SCHEMA}.payment_log WHERE kind='subscription'")
    all_cnt, all_sum = cur.fetchone()

    cur.execute(f"SELECT count(*) FILTER (WHERE active_until > now()), count(*), "
                f"count(*) FILTER (WHERE active_until > now() AND active_until < now() + interval '3 days') "
                f"FROM {SCHEMA}.driver_subs")
    active, total_subs, expiring = cur.fetchone()

    cur.execute(f"SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') m, count(*), coalesce(sum(amount_rub), 0) "
                f"FROM {SCHEMA}.payment_log WHERE kind='subscription' "
                f"AND created_at >= date_trunc('month', now()) - interval '11 months' GROUP BY 1 ORDER BY 1")
    by_month = [{'month': r[0], 'count': r[1], 'sum': float(r[2])} for r in cur.fetchall()]

    cur.execute(f"SELECT p.id, p.tg_user_id, coalesce(nullif(p.username, ''), s.username, '') , "
                f"coalesce(nullif(p.first_name, ''), s.first_name, ''), p.amount_rub, p.note, p.payment_id, "
                f"p.created_at, s.active_until "
                f"FROM {SCHEMA}.payment_log p LEFT JOIN {SCHEMA}.driver_subs s ON s.tg_user_id = p.tg_user_id "
                f"WHERE p.kind='subscription' AND p.created_at >= {m_start} AND p.created_at < {m_end} "
                f"ORDER BY p.created_at DESC LIMIT 500")
    payments = [{'id': r[0], 'tg_id': r[1], 'username': r[2], 'name': r[3], 'amount': float(r[4] or 0),
                 'note': r[5] or '', 'payment_id': r[6] or '', 'created_at': r[7], 'active_until': r[8]}
                for r in cur.fetchall()]

    cur.execute(f"SELECT tg_user_id, username, first_name, active_until FROM {SCHEMA}.driver_subs "
                f"ORDER BY active_until DESC NULLS LAST LIMIT 500")
    subscribers = [{'tg_id': r[0], 'username': r[1] or '', 'name': r[2] or '', 'active_until': r[3]}
                   for r in cur.fetchall()]

    return resp(200, {'ok': True, 'month': month, 'stats': {
        'month_count': m_cnt, 'month_sum': float(m_sum), 'month_users': m_users,
        'all_count': all_cnt, 'all_sum': float(all_sum),
        'active': active, 'total_subs': total_subs, 'expiring': expiring,
    }, 'by_month': by_month, 'payments': payments, 'subscribers': subscribers})


def handle_lists(cur, conn, method: str, qs: dict, body: dict) -> dict:
    if method == 'GET':
        cur.execute(f"SELECT {LIST_FIELDS} FROM {SCHEMA}.check_lists ORDER BY id DESC")
        items = [row_to_item(r) for r in cur.fetchall()]
        cur.execute(f"SELECT item_id, count(*) FROM {SCHEMA}.check_list_history "
                    f"WHERE source='scan' GROUP BY item_id")
        changes = dict(cur.fetchall())
        for it in items:
            it['changes'] = changes.get(it['id'], 0)
        return resp(200, {'ok': True, 'items': items})

    if method in ('POST', 'PUT'):
        role, lt = body.get('role'), body.get('list_type')
        if role not in ROLES or lt not in LIST_TYPES:
            return resp(400, {'error': 'bad role or list_type'})
        username = str(body.get('username') or '').strip().lstrip('@')
        if username.startswith('https://t.me/'):
            username = username[len('https://t.me/'):].strip('/')
        tg_id = parse_tg_id(body.get('tg_id'))
        name = str(body.get('name') or '')
        found = resolve_tg(cur, tg_id, username)
        if found:
            tg_id = tg_id or found[0]
            username = username or found[1]
            name = name or found[2]
        new = {
            'role': role, 'list_type': lt, 'name': name, 'username': username,
            'phone': clean_phone(body.get('phone')), 'note': str(body.get('note') or ''),
            'reason': str(body.get('reason') or ''), 'photo_url': str(body.get('photo_url') or ''),
            'tg_id': tg_id, 'removed_at': parse_date(body.get('removed_at')),
        }

        def sql_val(k):
            v = new[k]
            if v is None:
                return 'NULL'
            if k == 'tg_id':
                return str(int(v))
            return f"'{esc(v)}'"

        cols = list(new.keys())
        if method == 'POST':
            cur.execute(
                f"INSERT INTO {SCHEMA}.check_lists ({', '.join(cols)}) "
                f"VALUES ({', '.join(sql_val(k) for k in cols)}) RETURNING id")
            new_id = cur.fetchone()[0]
            conn.commit()
            return resp(200, {'ok': True, 'id': new_id, 'tg_id': tg_id})

        item_id = int(body.get('id') or 0)
        cur.execute(f"SELECT {LIST_FIELDS} FROM {SCHEMA}.check_lists WHERE id={item_id}")
        old_row = cur.fetchone()
        if not old_row:
            return resp(404, {'error': 'not found'})
        old = row_to_item(old_row)
        for k in cols:
            ov = '' if old.get(k) is None else str(old.get(k))
            nv = '' if new[k] is None else str(new[k])
            if ov != nv:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.check_list_history (item_id, field, old_value, new_value, source) "
                    f"VALUES ({item_id}, '{k}', '{esc(ov)}', '{esc(nv)}', 'manual')")
        cur.execute(
            f"UPDATE {SCHEMA}.check_lists SET {', '.join(f'{k}={sql_val(k)}' for k in cols)}, "
            f"updated_at=now() WHERE id={item_id}")
        conn.commit()
        return resp(200, {'ok': True, 'tg_id': tg_id})

    if method == 'DELETE':
        item_id = int(qs.get('id') or 0)
        cur.execute(f"DELETE FROM {SCHEMA}.check_list_history WHERE item_id={item_id}")
        cur.execute(f"DELETE FROM {SCHEMA}.check_lists WHERE id={item_id}")
        conn.commit()
        return resp(200, {'ok': True})

    return resp(405, {'error': 'Method not allowed'})


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    headers = event.get('headers') or {}
    token = headers.get('X-Admin-Token') or headers.get('x-admin-token') or ''
    if not verify_token(token):
        return resp(401, {'error': 'Unauthorized'})

    method = event.get('httpMethod', 'GET')
    qs = event.get('queryStringParameters') or {}
    body = json.loads(event.get('body') or '{}') if method in ('POST', 'PUT') else {}

    if qs.get('entity') == 'upload_photo' and method == 'POST':
        return upload_photo(body)

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        if qs.get('entity') == 'subs':
            return handle_subs_stats(cur, qs)
        if qs.get('entity') == 'history':
            return handle_history(cur, qs)
        if qs.get('entity') == 'lookup':
            return handle_lookup(cur, qs)
        if qs.get('entity') == 'lists':
            return handle_lists(cur, conn, method, qs, body)

        if method == 'GET':
            cur.execute(f"SELECT id, title, category, content, created_at, updated_at FROM {SCHEMA}.knowledge_base ORDER BY category, title, id")
            items = [{'id': r[0], 'title': r[1], 'category': r[2], 'content': r[3],
                      'created_at': r[4], 'updated_at': r[5]} for r in cur.fetchall()]
            return resp(200, {'ok': True, 'items': items})

        if method == 'POST':
            cur.execute(
                f"INSERT INTO {SCHEMA}.knowledge_base (title, category, content) "
                f"VALUES ('{esc(body.get('title'))}', '{esc(body.get('category'))}', '{esc(body.get('content'))}') RETURNING id")
            new_id = cur.fetchone()[0]
            conn.commit()
            return resp(200, {'ok': True, 'id': new_id})

        if method == 'PUT':
            item_id = int(body.get('id') or 0)
            cur.execute(
                f"UPDATE {SCHEMA}.knowledge_base SET title='{esc(body.get('title'))}', "
                f"category='{esc(body.get('category'))}', content='{esc(body.get('content'))}', "
                f"updated_at=now() WHERE id={item_id}")
            conn.commit()
            return resp(200, {'ok': True})

        if method == 'DELETE':
            item_id = int(qs.get('id') or 0)
            cur.execute(f"DELETE FROM {SCHEMA}.knowledge_base WHERE id={item_id}")
            conn.commit()
            return resp(200, {'ok': True})

        return resp(405, {'error': 'Method not allowed'})
    finally:
        cur.close()
        conn.close()
