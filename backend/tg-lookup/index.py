"""
Поиск аккаунта Telegram по @username через подключённый user-аккаунт.
GET ?username=name или ?phone=79991234567 — возвращает Telegram ID, имя, username, телефон (если открыт), описание и фото.
"""
import os
import json
import uuid
import asyncio
import time
import hashlib
import random
import psycopg2
from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.tl.functions.users import GetFullUserRequest
from telethon.tl.functions.contacts import ImportContactsRequest, DeleteContactsRequest
from telethon.tl.types import InputPhoneContact
from telethon.tl.types import User

SCHEMA = 't_p67171637_yug_transfer_prize_l'
CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
}


def resp(code: int, data: dict) -> dict:
    return {'statusCode': code, 'headers': {**CORS, 'Content-Type': 'application/json'},
            'body': json.dumps(data, ensure_ascii=False, default=str)}


def verify_token(token: str) -> bool:
    if not token:
        return False
    a = hashlib.sha256(f"{os.environ.get('ADMIN_LOGIN', '')}:{os.environ.get('ADMIN_PASSWORD', '')}:admin_secret_2026".encode()).hexdigest()
    pl = os.environ.get('POSTS_LOGIN', '')
    p = hashlib.sha256(f"{pl}:{os.environ.get('POSTS_PASSWORD', '')}:posts_secret_2026".encode()).hexdigest()
    return token == a or (bool(pl) and token == p)


def clean_username(v: str) -> str:
    v = (v or '').strip()
    for pref in ('https://t.me/', 'http://t.me/', 't.me/'):
        if v.lower().startswith(pref):
            v = v[len(pref):]
    return v.strip('/').lstrip('@').split('?')[0]


def load_sessions(cur, purpose: str = 'scan') -> list:
    """purpose='scan' — для сканирования базы (аккаунты бота не трогаем, их лимиты берегём для живых запросов);
    purpose='bot' — для поиска по запросу: сначала аккаунты бота, затем остальные как запасные."""
    order = "CASE WHEN purpose='bot' THEN 0 ELSE 1 END, " if purpose == 'bot' else ''
    only = "AND purpose <> 'bot' " if purpose == 'scan' else ''
    cur.execute(f"SELECT session_string FROM {SCHEMA}.tg_user_accounts "
                f"WHERE coalesce(session_string, '') <> '' AND NOT coalesce(is_banned, FALSE) {only}"
                f"ORDER BY {order}is_active DESC, last_used_at DESC NULLS LAST")
    sessions = [r[0] for r in cur.fetchall()]
    cur.execute(f"SELECT session_string FROM {SCHEMA}.tg_user_session WHERE coalesce(session_string, '') <> ''")
    sessions += [r[0] for r in cur.fetchall()]
    return sessions


def bot_session_keys(cur) -> set:
    cur.execute(f"SELECT session_string FROM {SCHEMA}.tg_user_accounts WHERE purpose='bot' AND coalesce(session_string,'') <> ''")
    return {hashlib.sha256(r[0].encode()).hexdigest()[:24] for r in cur.fetchall()}


def store_photo(raw: bytes) -> str:
    import boto3
    key = f"check-lists/tg-{uuid.uuid4().hex}.jpg"
    s3 = boto3.client('s3', endpoint_url='https://bucket.poehali.dev',
                      aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
                      aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'])
    s3.put_object(Bucket='files', Key=key, Body=raw, ContentType='image/jpeg')
    return f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"


async def resolve_phone(client, phone: str):
    """Находит аккаунт по номеру: временно добавляем в контакты и сразу удаляем."""
    res = await client(ImportContactsRequest([InputPhoneContact(client_id=0, phone=phone, first_name='check', last_name='')]))
    if not res.users:
        return None
    user = res.users[0]
    try:
        await client(DeleteContactsRequest(id=[user]))
    except Exception as e:
        print(f'[TG-LOOKUP] delete contact failed: {type(e).__name__}')
    try:
        # После удаления из контактов Telegram отдаёт настоящее имя, которое человек указал сам.
        from telethon.tl.functions.users import GetUsersRequest
        fresh = await client(GetUsersRequest([user]))
        if fresh:
            user = fresh[0]
    except Exception as e:
        print(f'[TG-LOOKUP] refresh user failed: {type(e).__name__}')
    return user


# Как и с постами: часть адресов Telegram из облака закрыта — перебираем запасные IP каждого дата-центра.
DC_IPS = {
    1: ['149.154.175.53', '149.154.175.50', '149.154.175.54', '149.154.175.55', '149.154.175.59'],
    2: ['149.154.167.41', '149.154.167.51', '149.154.167.50', '149.154.167.222'],
    3: ['149.154.175.100', '149.154.175.211'],
    4: ['149.154.167.91', '149.154.167.92', '149.154.166.120', '149.154.167.41'],
    5: ['91.108.56.130', '91.108.56.128', '91.108.56.151', '91.108.56.100'],
}
OPEN_IP = {}


def pick_ip(dc: int, default_ip: str) -> str:
    """Быстро проверяем, какой адрес дата-центра отвечает, и запоминаем его."""
    import socket
    import concurrent.futures as cf
    if OPEN_IP.get(dc):
        return OPEN_IP[dc]
    cands = list(dict.fromkeys([*DC_IPS.get(dc, []), default_ip]))

    def probe(ip):
        try:
            socket.create_connection((ip, 443), timeout=1.5).close()
            return ip
        except Exception:
            return None
    with cf.ThreadPoolExecutor(max_workers=len(cands)) as pool:
        for ip in pool.map(probe, cands):
            if ip:
                OPEN_IP[dc] = ip
                print(f'[TG-LOOKUP] dc{dc} -> {ip}')
                return ip
    print(f'[TG-LOOKUP] dc{dc}: no open ip, using {default_ip}')
    return default_ip


def proxy_kwargs() -> dict:
    """TG_PROXY: socks5://user:pass@host:port | http://host:port | mtproxy://SECRET@host:port"""
    from urllib.parse import urlparse, unquote
    raw = (os.environ.get('TG_PROXY') or '').strip()
    if not raw:
        return {}
    if '://' not in raw:
        parts = raw.replace('@', ':').split(':')
        if len(parts) == 4 and parts[1].isdigit():
            raw = f'socks5://{parts[2]}:{parts[3]}@{parts[0]}:{parts[1]}'
        elif len(parts) == 4 and parts[3].isdigit():
            raw = f'socks5://{parts[0]}:{parts[1]}@{parts[2]}:{parts[3]}'
        else:
            raw = 'socks5://' + raw
    u = urlparse(raw)
    if u.scheme == 'mtproxy':
        from telethon import connection
        return {'connection': connection.ConnectionTcpMTProxyRandomizedIntermediate,
                'proxy': (u.hostname, u.port or 443, unquote(u.username or ''))}
    ptype = 'socks5' if u.scheme.startswith('socks') else u.scheme
    print(f'[TG-LOOKUP] proxy {ptype} {u.hostname}:{u.port} auth={bool(u.username)}')
    return {'proxy': {'proxy_type': ptype, 'addr': u.hostname, 'port': u.port,
                      'username': unquote(u.username) if u.username else None,
                      'password': unquote(u.password) if u.password else None, 'rdns': True}}


def make_client(session: str):
    sess = StringSession(session)
    if not sess.dc_id:
        sess.set_dc(2, DC_IPS[2][0], 443)
    extra = proxy_kwargs()
    if extra and isinstance(extra.get('proxy'), dict):
        # Прокси не пускает на «голые» IP Telegram — подключаемся через доменное имя того же адреса.
        from telethon.network.connection import ConnectionTcpFull

        class NamedHostConnection(ConnectionTcpFull):
            def __init__(self, ip, port, dc_id, **kw):
                super().__init__(ip, port, dc_id, **kw)
                if ip.replace('.', '').isdigit():
                    self._ip = f"{ip.replace('.', '-')}.nip.io"
                print(f'[TG-LOOKUP] dc{dc_id} via {self._ip}')
        extra = {**extra, 'connection': NamedHostConnection}
    if not extra:
        from telethon import connection
        ip = pick_ip(sess.dc_id, sess.server_address)
        sess.set_dc(sess.dc_id, ip, 443)
        # Обфусцированный канал: фильтры сети не распознают его как трафик Telegram.
        extra = {'connection': connection.ConnectionTcpObfuscated}
    client = TelegramClient(sess, int(os.environ['TG_API_ID']), os.environ['TG_API_HASH'],
                            connection_retries=1, retry_delay=0, timeout=6, receive_updates=False,
                            **extra)
    return client


async def lookup(session: str, username: str, phone: str = '', finder=None) -> dict:
    t0 = time.time()
    client = make_client(session)
    await client.connect()
    print(f'[TG-LOOKUP] connected in {time.time() - t0:.2f}s')
    try:
        if not await client.is_user_authorized():
            return {'retry': True, 'error': 'session not authorized'}
        if finder is not None:
            entity = await finder(client)
            if entity is None:
                return {'error': 'Не удалось найти человека через группу'}
        elif phone:
            entity = await resolve_phone(client, phone)
            if entity is None:
                return {'error': 'По этому номеру аккаунт не найден или скрыт настройками приватности'}
        else:
            entity = await client.get_entity(username)
        if not isinstance(entity, User):
            return {'error': 'Это не личный аккаунт, а группа или канал'}
        bio = ''
        try:
            full = await client(GetFullUserRequest(entity))
            bio = getattr(full.full_user, 'about', '') or ''
        except Exception as e:
            print(f'[TG-LOOKUP] full user failed: {type(e).__name__}')
        photo_url, photo_uid = '', ''
        print(f'[TG-LOOKUP] entity in {time.time() - t0:.2f}s')
        if entity.photo and getattr(entity.photo, 'photo_id', None) and time.time() - t0 < 15:
            try:
                raw = await asyncio.wait_for(client.download_profile_photo(entity, file=bytes, download_big=True), timeout=8)
            except Exception as e:
                print(f'[TG-LOOKUP] photo failed: {type(e).__name__}')
                raw = b''
            if raw:
                photo_url = store_photo(raw)
                photo_uid = str(entity.photo.photo_id)
        return {
            'tg_id': entity.id,
            'username': entity.username or username or '',
            'name': ' '.join(x for x in [entity.first_name or '', entity.last_name or ''] if x).strip(),
            'phone': f"+{entity.phone}" if entity.phone else (f"+{phone}" if phone else ''),
            'bio': bio,
            'photo_url': photo_url,
            'photo_uid': photo_uid,
            'is_bot': bool(entity.bot),
            'deleted': bool(entity.deleted),
        }
    except ValueError:
        return {'error': 'Аккаунт с таким username не найден'}
    except Exception as e:
        name = type(e).__name__
        print(f'[TG-LOOKUP] {name}: {e}')
        if 'UsernameNotOccupied' in name or 'UsernameInvalid' in name:
            return {'error': 'Аккаунт с таким username не найден'}
        if 'FloodWait' in name:
            return {'retry': True, 'error': name, 'flood': int(getattr(e, 'seconds', 600) or 600)}
        return {'retry': True, 'error': name}
    finally:
        await client.disconnect()


def save_cache(cur, d: dict) -> None:
    def q(v):
        return str(v or '').replace("'", "''")
    first, _, last = d['name'].partition(' ')
    cur.execute(
        f"INSERT INTO {SCHEMA}.tg_users (tg_id, username, first_name, last_name, phone, source) "
        f"VALUES ({int(d['tg_id'])}, '{q(d['username'])}', '{q(first)}', '{q(last)}', '{q(d['phone'])}', 'lookup') "
        f"ON CONFLICT (tg_id) DO UPDATE SET username=EXCLUDED.username, first_name=EXCLUDED.first_name, "
        f"last_name=EXCLUDED.last_name, phone=CASE WHEN EXCLUDED.phone <> '' THEN EXCLUDED.phone ELSE {SCHEMA}.tg_users.phone END, "
        f"updated_at=now()")


def sess_key(session: str) -> str:
    return hashlib.sha256(session.encode()).hexdigest()[:24]


SCAN_PER_HOUR = 20
BOT_PER_HOUR = 40
SCAN_PAUSE = (2.5, 4.5)


def usage_map(cur) -> dict:
    """Сколько запросов в Telegram сделал каждый аккаунт за последний час."""
    cur.execute(f"SELECT session_hash, sum(cnt) FROM {SCHEMA}.tg_session_usage "
                f"WHERE hour_at > now() - interval '1 hour' GROUP BY 1")
    return {r[0]: int(r[1]) for r in cur.fetchall()}


def usage_add(cur, conn, key: str, n: int) -> None:
    if n <= 0:
        return
    cur.execute(f"INSERT INTO {SCHEMA}.tg_session_usage (session_hash, hour_at, cnt) "
                f"VALUES ('{key}', date_trunc('minute', now()), {int(n)}) "
                f"ON CONFLICT (session_hash, hour_at) DO UPDATE SET cnt = {SCHEMA}.tg_session_usage.cnt + {int(n)}")
    cur.execute(f"DELETE FROM {SCHEMA}.tg_session_usage WHERE hour_at < now() - interval '1 day'")
    conn.commit()


def fill_from_cache(cur, conn, rows: list) -> list:
    """Тех, кого бот уже знает (ID и имя), заполняем из своей базы — без запроса в Telegram."""
    names = [str(u).lower().replace("'", "''") for _, u in rows if u]
    if not names:
        return rows
    cur.execute(f"SELECT lower(username), tg_id, trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')), coalesce(phone,'') "
                f"FROM {SCHEMA}.tg_users WHERE coalesce(username,'') <> '' AND lower(username) IN ({','.join(chr(39) + n + chr(39) for n in names)}) "
                f"AND updated_at > now() - interval '30 days'")
    known = {r[0]: r for r in cur.fetchall()}
    left = []
    for row_id, uname in rows:
        k = known.get(str(uname).lower())
        if not k:
            left.append((row_id, uname))
            continue
        q = lambda v: str(v or '').replace("'", "''")
        try:
            cur.execute(f"UPDATE {SCHEMA}.check_lists SET last_scan_at=now(), scan_status='ok', tg_id=COALESCE(tg_id, {int(k[1])}), "
                        f"name=CASE WHEN name='' THEN '{q(k[2])}' ELSE name END, "
                        f"phone=CASE WHEN phone='' THEN '{q(k[3])}' ELSE phone END WHERE id={int(row_id)}")
            conn.commit()
        except psycopg2.errors.UniqueViolation:
            conn.rollback()
            cur.execute(f"DELETE FROM {SCHEMA}.check_lists WHERE id={int(row_id)} AND list_type='pending'")
            conn.commit()
    return left


async def batch_scan(session: str, rows: list, deadline: float, cur, conn, stats: dict) -> dict:
    """Пачкой сканирует карточки модерации одним подключением, пока есть время."""
    from telethon.errors import FloodWaitError
    client = make_client(session)
    t0 = time.time()
    await asyncio.wait_for(client.connect(), timeout=8)
    print(f'[TG-LOOKUP] batch connected {time.time() - t0:.1f}s')
    try:
        if not await asyncio.wait_for(client.is_user_authorized(), timeout=6):
            stats['flood'] = 86400
            return stats
        for row_id, uname in rows:
            if deadline - time.time() < 7:
                break
            sets = ["last_scan_at=now()"]
            try:
                entity = await asyncio.wait_for(client.get_entity(uname), timeout=6)
                if not isinstance(entity, User):
                    sets.append("scan_status='не личный аккаунт'")
                    stats['missing'] += 1
                else:
                    bio = ''
                    try:
                        full = await asyncio.wait_for(client(GetFullUserRequest(entity)), timeout=4)
                        bio = getattr(full.full_user, 'about', '') or ''
                    except Exception:
                        pass
                    photo_url, photo_uid = '', ''
                    if entity.photo and getattr(entity.photo, 'photo_id', None) and deadline - time.time() > 4:
                        try:
                            raw = await asyncio.wait_for(client.download_profile_photo(entity, file=bytes, download_big=False), timeout=4)
                            if raw:
                                photo_url, photo_uid = store_photo(raw), str(entity.photo.photo_id)
                        except Exception:
                            pass
                    name = ' '.join(x for x in [entity.first_name or '', entity.last_name or ''] if x).strip()
                    phone = f"+{entity.phone}" if entity.phone else ''
                    q = lambda v: str(v or '').replace("'", "''")
                    sets += [f"tg_id={int(entity.id)}", f"name=CASE WHEN name='' THEN '{q(name)}' ELSE name END",
                             f"bio='{q(bio)}'", f"scan_status='ok'"]
                    if photo_url:
                        sets += [f"photo_url='{q(photo_url)}'", f"photo_file_uid='{q(photo_uid)}'"]
                    if phone:
                        sets.append(f"phone=CASE WHEN phone='' THEN '{q(phone)}' ELSE phone END")
                    save_cache(cur, {'tg_id': entity.id, 'username': entity.username or uname, 'name': name, 'phone': phone})
                    stats['found'] += 1
            except FloodWaitError as e:
                stats['flood'] = int(e.seconds)
                print(f'[TG-LOOKUP] flood wait {e.seconds}s')
                break
            except (ValueError, asyncio.TimeoutError) as e:
                if isinstance(e, asyncio.TimeoutError):
                    print(f'[TG-LOOKUP] batch timeout on {uname}')
                    break
                sets.append("scan_status='не найден'")
                stats['missing'] += 1
            except Exception as e:
                n = type(e).__name__
                if 'Username' in n:
                    sets.append("scan_status='не найден'")
                    stats['missing'] += 1
                else:
                    print(f'[TG-LOOKUP] batch {uname}: {n}')
                    break
            try:
                cur.execute(f"UPDATE {SCHEMA}.check_lists SET {', '.join(sets)} WHERE id={int(row_id)}")
                conn.commit()
            except psycopg2.errors.UniqueViolation:
                # Тот же человек уже есть в базе под другим username — дубль с модерации убираем.
                conn.rollback()
                cur.execute(f"DELETE FROM {SCHEMA}.check_lists WHERE id={int(row_id)} AND list_type='pending'")
                if not cur.rowcount:
                    cur.execute(f"UPDATE {SCHEMA}.check_lists SET last_scan_at=now(), scan_status='дубль другой карточки' WHERE id={int(row_id)}")
                conn.commit()
                stats['dupes'] = stats.get('dupes', 0) + 1
            stats['done'] += 1
            if deadline - time.time() > 10:
                await asyncio.sleep(random.uniform(*SCAN_PAUSE))
    finally:
        await client.disconnect()
    return stats


def handle_batch(context, scope: str = 'all') -> dict:
    started = time.time()
    try:
        budget = context.get_remaining_time_in_millis() / 1000 - 2
    except Exception:
        budget = 3
    deadline = started + budget
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    total = {'done': 0, 'found': 0, 'missing': 0}
    try:
        cur.execute(f"SELECT session_hash FROM {SCHEMA}.tg_session_flood WHERE until_at > now()")
        blocked = {r[0] for r in cur.fetchall()}
        sessions = [x for x in load_sessions(cur) if sess_key(x) not in blocked]
        sessions.sort(key=lambda x: 0 if StringSession(x).dc_id == 2 else 1)
        # Если у бота нет своего свободного аккаунта — последний свободный оставляем для живых запросов из бота.
        bot_free = [k for k in bot_session_keys(cur) if k not in blocked]
        reserved = False
        if not bot_free and sessions:
            sessions = sessions[:-1]
            reserved = True
            print('[TG-LOOKUP] batch: last free account reserved for bot')
        print(f'[TG-LOOKUP] batch sessions {len(sessions)}, blocked {len(blocked)}')
        used = usage_map(cur)
        quota = {sess_key(x): SCAN_PER_HOUR - used.get(sess_key(x), 0) for x in sessions}
        workers = [x for x in sessions if quota[sess_key(x)] > 0][:4]
        if sessions and not workers:
            print('[TG-LOOKUP] batch: hourly limit reached on all accounts')
        where = ("list_type='pending' AND " if scope == 'pending' else '') + "username <> '' AND last_scan_at IS NULL"
        cur.execute(f"SELECT id, username FROM {SCHEMA}.check_lists WHERE {where} "
                    f"ORDER BY (list_type='pending') DESC, id DESC LIMIT 200")
        fetched = cur.fetchall()
        rows = fill_from_cache(cur, conn, fetched)
        from_cache = len(fetched) - len(rows)
        rows = rows[:sum(min(6, quota[sess_key(w)]) for w in workers)]
        parts = []
        pos = 0
        for w in workers:
            n = min(6, quota[sess_key(w)])
            parts.append(rows[pos:pos + n])
            pos += n
        stats = [{'done': 0, 'found': 0, 'missing': 0, 'flood': 0} for _ in workers]

        async def run_all():
            async def one(i, sess):
                try:
                    await asyncio.wait_for(batch_scan(sess, parts[i], deadline, cur, conn, stats[i]),
                                           timeout=max(2, deadline - time.time()))
                except asyncio.TimeoutError:
                    stats[i]['cut'] = True
                except Exception as e:
                    print(f'[TG-LOOKUP] batch session failed: {type(e).__name__}: {str(e)[:150]}')
                    if not stats[i]['done']:
                        stats[i]['flood'] = 300
            await asyncio.gather(*(one(i, w) for i, w in enumerate(workers)))

        if rows and workers:
            asyncio.run(run_all())
        for sess, st in zip(workers, stats):
            print(f'[TG-LOOKUP] batch result {st}')
            usage_add(cur, conn, sess_key(sess), st.get('done', 0))
            for k in total:
                total[k] += st.get(k, 0)
            if st.get('flood') and not st.get('cut'):
                cur.execute(f"INSERT INTO {SCHEMA}.tg_session_flood (session_hash, until_at) VALUES "
                            f"('{sess_key(sess)}', now() + interval '{int(st['flood']) + 30} seconds') "
                            f"ON CONFLICT (session_hash) DO UPDATE SET until_at = EXCLUDED.until_at")
                conn.commit()
        cur.execute(f"SELECT count(*) FROM {SCHEMA}.check_lists WHERE {where}")
        left = cur.fetchone()[0]
        cur.execute(f"SELECT count(*), coalesce(extract(epoch from min(until_at) - now()), 0)::int "
                    f"FROM {SCHEMA}.tg_session_flood WHERE until_at > now()")
        paused, resume_in = cur.fetchone()
        accounts = len(load_sessions(cur))
        total['done'] += from_cache
        total['found'] += from_cache
        hour_limit = bool(sessions) and not workers
        return resp(200, {'ok': True, **total, 'from_cache': from_cache, 'hour_limit': hour_limit, 'left': left, 'accounts': accounts, 'paused': paused,
                          'all_paused': (accounts > 0 and paused >= accounts) or (reserved and not workers),
                          'reserved': reserved and not workers, 'resume_in': resume_in})
    finally:
        cur.close()
        conn.close()


def apply_rescan(cur, item_id: int, d: dict) -> dict:
    """Сравнивает свежие данные из Telegram с карточкой: изменения пишет в историю и создаёт новый слой."""
    q = lambda v: str(v or '').replace("'", "''")
    cur.execute(f"SELECT tg_id, name, username, bio, photo_url, photo_file_uid, phone FROM {SCHEMA}.check_lists WHERE id={int(item_id)}")
    row = cur.fetchone()
    if not row:
        return {'status': 'not_found', 'changes': 0}
    tg_id, name, username, bio, photo_url, photo_uid, phone = row
    changes, sets = [], []

    def track(field, old, new):
        if new and (old or '') != new:
            changes.append((field, old or '', new))
            sets.append(f"{field}='{q(new)}'")

    track('name', name, d.get('name'))
    track('username', username, d.get('username'))
    if (bio or '') != (d.get('bio') or ''):
        changes.append(('bio', bio or '', d.get('bio') or ''))
        sets.append(f"bio='{q(d.get('bio'))}'")
    if not phone and d.get('phone'):
        sets.append(f"phone='{q(d['phone'])}'")
    if not tg_id and d.get('tg_id'):
        sets.append(f"tg_id={int(d['tg_id'])}")
    new_uid = str(d.get('photo_uid') or '')
    if d.get('photo_url') and new_uid != (photo_uid or ''):
        # Старые отметки фото от бота в другом формате — их просто заменяем, без ложного слоя.
        if photo_uid and photo_uid.isdigit():
            changes.append(('photo_url', photo_url or '', d['photo_url']))
        sets += [f"photo_url='{q(d['photo_url'])}'", f"photo_file_uid='{q(new_uid)}'"]
    for field, old, new in changes:
        cur.execute(f"INSERT INTO {SCHEMA}.check_list_history (item_id, field, old_value, new_value, source) "
                    f"VALUES ({int(item_id)}, '{field}', '{q(old)}', '{q(new)}', 'scan')")
    status = f"изменений: {len(changes)}" if changes else 'без изменений'
    sets += ['last_scan_at=now()', f"scan_status='{status}'", 'updated_at=now()']
    cur.execute(f"UPDATE {SCHEMA}.check_lists SET {', '.join(sets)} WHERE id={int(item_id)}")
    if changes:
        fields = ','.join(dict.fromkeys(f for f, _, _ in changes))
        cur.execute(f"INSERT INTO {SCHEMA}.check_list_snapshots "
                    f"(item_id, tg_id, name, username, phone, bio, photo_url, source, changed_fields) "
                    f"SELECT id, tg_id, name, username, phone, bio, photo_url, 'scan', '{fields}' "
                    f"FROM {SCHEMA}.check_lists WHERE id={int(item_id)}")
    return {'status': 'ok', 'changes': len(changes), 'fields': [f for f, _, _ in changes]}


GROUP_QUERIES = [''] + list('абвгдеёжзийклмнопрстуфхцчшщэюяabcdefghijklmnopqrstuvwxyz0123456789_')
EXCLUDED_CHATS = {'-1002146850254', '2146850254', '-2146850254', '-1003740884399', '3740884399', 'chernyi_spisok_transfer'}


async def resolve_chat(client, chat: str):
    """Находит группу по ссылке, @username или числовому ID (через список диалогов аккаунта)."""
    c = chat.strip()
    for pref in ('https://t.me/', 'http://t.me/', 't.me/', 'tg://chat?id='):
        if c.lower().startswith(pref):
            c = c[len(pref):]
    c = c.strip('/').lstrip('@')
    if c.lstrip('-').isdigit():
        want = int(c)
        short = int(str(abs(want))[3:]) if str(abs(want)).startswith('100') else abs(want)
        async for d in client.iter_dialogs(limit=500):
            if d.id == want or getattr(d.entity, 'id', None) in (short, abs(want)):
                return d.entity
        return None
    if c.startswith('+') or c.startswith('joinchat/'):
        return None
    try:
        ent = await client.get_entity(c)
    except Exception:
        return None
    try:
        from telethon.tl.functions.channels import JoinChannelRequest
        await client(JoinChannelRequest(ent))
    except Exception as e:
        print(f'[TG-LOOKUP] join skipped: {type(e).__name__}')
    return ent


def insert_users(cur, users: list, title: str) -> int:
    q = lambda v: str(v or '').replace("'", "''")
    vals = []
    for u in users:
        name = ' '.join(x for x in [u.first_name or '', u.last_name or ''] if x).strip()
        un = u.username or ''
        ph = f"+{u.phone}" if u.phone else ''
        scanned = "NULL, ''" if un else "now(), 'из группы'"
        vals.append(f"('', 'pending', '{q(name)}', '{q(un)}', '{q(ph)}', '', {int(u.id)}, '{q(title)[:120]}', {scanned})")
    if not vals:
        return 0
    cache = {}
    for u in users:
        if u.username:
            cache[u.id] = (f"({int(u.id)}, '{q(u.username)}', '{q(u.first_name or '')}', '{q(u.last_name or '')}', "
                           f"'{q(u.phone or '')}', 'group')")
    if cache:
        cur.execute(f"INSERT INTO {SCHEMA}.tg_users (tg_id, username, first_name, last_name, phone, source) VALUES "
                    f"{', '.join(cache.values())} ON CONFLICT (tg_id) DO UPDATE SET username=EXCLUDED.username, "
                    f"first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name, updated_at=now()")
    cur.execute(f"INSERT INTO {SCHEMA}.check_lists (role, list_type, name, username, phone, note, tg_id, "
                f"source, last_scan_at, scan_status) VALUES {', '.join(vals)} ON CONFLICT DO NOTHING RETURNING id")
    return len(cur.fetchall())


def save_job(cur, conn, job: dict) -> None:
    q = lambda v: str(v or '').replace("'", "''")
    cur.execute(f"UPDATE {SCHEMA}.group_scan_jobs SET q_index={job['q_index']}, q_offset={job['q_offset']}, "
                f"fetched={job['fetched']}, added={job['added']}, skipped={job['skipped']}, "
                f"total={int(job.get('total') or 0)}, title='{q(job.get('title'))}', last_msg_id={int(job.get('last_msg_id') or 0)}, "
                f"messages={int(job.get('messages') or 0)}, updated_at=now() WHERE id={job['id']}")
    conn.commit()


async def history_pull(client, chat, job: dict, deadline: float, cur, conn) -> dict:
    """Собирает всех, кто писал в группе: идём по истории сообщений от новых к старым."""
    from telethon.tl.functions.messages import GetHistoryRequest
    from telethon.errors import FloodWaitError
    offset_id = int(job.get('last_msg_id') or 0)
    while time.time() < deadline - 3:
        try:
            res = await asyncio.wait_for(client(GetHistoryRequest(
                peer=chat, offset_id=offset_id, offset_date=None, add_offset=0, limit=100,
                max_id=0, min_id=0, hash=0)), timeout=8)
        except FloodWaitError as e:
            return {'flood': e.seconds}
        if not res.messages:
            job['q_index'] = len(GROUP_QUERIES)
            break
        offset_id = min(m.id for m in res.messages)
        users = [u for u in res.users if isinstance(u, User) and not u.bot and not u.deleted]
        added = insert_users(cur, users, job['title'])
        job['added'] += added
        job['skipped'] += len(users) - added
        job['fetched'] += len(users)
        job['messages'] = int(job.get('messages') or 0) + len(res.messages)
        job['last_msg_id'] = offset_id
        total_msgs = getattr(res, 'count', 0) or 0
        if total_msgs:
            job['q_index'] = min(len(GROUP_QUERIES) - 1, int(job['messages'] / total_msgs * len(GROUP_QUERIES)))
        save_job(cur, conn, job)
        await asyncio.sleep(0.4)
    return {}


async def photos_pull(client, chat, job: dict, deadline: float, cur, conn, skey: str) -> dict:
    """Фото участников группы без поиска по username: аккаунт-админ видит людей напрямую, лимиты Telegram не тратятся."""
    from telethon.tl.functions.channels import GetParticipantsRequest
    from telethon.tl.types import ChannelParticipantsSearch
    from telethon.errors import FloodWaitError
    sem = asyncio.Semaphore(8)

    async def grab(u):
        async with sem:
            try:
                return u, await asyncio.wait_for(client.download_profile_photo(u, file=bytes, download_big=False), timeout=8)
            except Exception:
                return u, b''

    while time.time() < deadline - 4 and job['q_index'] < len(GROUP_QUERIES):
        try:
            res = await asyncio.wait_for(client(GetParticipantsRequest(
                chat, ChannelParticipantsSearch(GROUP_QUERIES[job['q_index']]), job['q_offset'], 200, hash=0)), timeout=8)
        except FloodWaitError as e:
            return {'flood': e.seconds}
        users = {u.id: u for u in res.users if not u.bot and not u.deleted}
        page_done = True
        if users:
            cur.execute(f"SELECT tg_id FROM {SCHEMA}.check_lists WHERE tg_id IN ({','.join(str(i) for i in users)}) "
                        f"AND coalesce(photo_url, '') = ''")
            need = [users[r[0]] for r in cur.fetchall() if r[0] in users]
            with_photo = [u for u in need if getattr(u, 'photo', None) and getattr(u.photo, 'photo_id', None)]
            without = [u for u in need if u not in with_photo]
            if without:
                cur.execute(f"UPDATE {SCHEMA}.check_lists SET last_scan_at=now(), scan_status='нет фото', "
                            f"tg_access_hash=CASE tg_id {' '.join(f'WHEN {u.id} THEN {int(u.access_hash or 0)}' for u in without)} END, "
                            f"access_session='{skey}' WHERE tg_id IN ({','.join(str(u.id) for u in without)}) AND list_type='pending'")
                job['skipped'] += cur.rowcount
            for i in range(0, len(with_photo), 24):
                if time.time() > deadline - 4:
                    page_done = False
                    break
                chunk = with_photo[i:i + 24]
                got = await asyncio.gather(*(grab(u) for u in chunk))
                for u, raw in got:
                    if not raw:
                        continue
                    url = await asyncio.get_running_loop().run_in_executor(None, store_photo, raw)
                    cur.execute(f"UPDATE {SCHEMA}.check_lists SET photo_url='{url}', photo_file_uid='{u.photo.photo_id}', "
                                f"tg_access_hash={int(u.access_hash or 0)}, access_session='{skey}', "
                                f"last_scan_at=coalesce(last_scan_at, now()), "
                                f"scan_status=CASE WHEN scan_status IN ('', 'из группы', 'нет фото') THEN 'ok' ELSE scan_status END "
                                f"WHERE tg_id={int(u.id)}")
                    job['added'] += 1
                conn.commit()
            job['fetched'] += len(res.users) if page_done else 0
        if not page_done:
            save_job(cur, conn, job)
            break
        if len(res.users) < 200:
            job['q_index'] += 1
            job['q_offset'] = 0
        else:
            job['q_offset'] += 200
            if job['q_offset'] >= 10000:
                job['q_index'] += 1
                job['q_offset'] = 0
        save_job(cur, conn, job)
        await asyncio.sleep(0.5)
    return {}


async def group_pull(session: str, job: dict, deadline: float, cur, conn) -> dict:
    """Выгружает участников группы порциями по 200 (поиск по буквам обходит лимит Telegram в 10 000)."""
    from telethon.tl.functions.channels import GetParticipantsRequest, GetFullChannelRequest
    from telethon.tl.types import ChannelParticipantsSearch
    from telethon.errors import FloodWaitError
    client = make_client(session)
    await asyncio.wait_for(client.connect(), timeout=8)
    try:
        if not await client.is_user_authorized():
            return {'error': 'session'}
        chat = await resolve_chat(client, job['chat'])
        if chat is None:
            return {'error': 'no_access'}
        is_admin = bool(getattr(chat, 'admin_rights', None) or getattr(chat, 'creator', False))
        if job.get('mode') != 'history' and not is_admin:
            return {'error': 'not_admin'}
        if not job.get('title'):
            job['title'] = getattr(chat, 'title', '') or job['chat']
        try:
            full = await client(GetFullChannelRequest(chat))
            job['total'] = full.full_chat.participants_count or job.get('total', 0)
        except Exception:
            pass
        if job.get('mode') == 'history':
            return await history_pull(client, chat, job, deadline, cur, conn)
        if job.get('mode') == 'photos':
            return await photos_pull(client, chat, job, deadline, cur, conn, sess_key(session))
        while time.time() < deadline - 3 and job['q_index'] < len(GROUP_QUERIES):
            try:
                res = await asyncio.wait_for(client(GetParticipantsRequest(
                    chat, ChannelParticipantsSearch(GROUP_QUERIES[job['q_index']]), job['q_offset'], 200, hash=0)), timeout=8)
            except FloodWaitError as e:
                return {'flood': e.seconds}
            users = [u for u in res.users if not u.bot and not u.deleted]
            if users:
                added = insert_users(cur, users, job['title'])
                job['added'] += added
                job['skipped'] += len(users) - added
                job['fetched'] += len(res.users)
            if len(res.users) < 200:
                job['q_index'] += 1
                job['q_offset'] = 0
            else:
                job['q_offset'] += 200
                if job['q_offset'] >= 10000:
                    job['q_index'] += 1
                    job['q_offset'] = 0
            save_job(cur, conn, job)
            await asyncio.sleep(0.8)
        return {}
    finally:
        await client.disconnect()


async def find_admin_session(sessions: list, chat_ref: str) -> str:
    """Параллельно проверяет аккаунты и возвращает тот, что админ группы (видит всех участников)."""
    async def check(sess):
        client = make_client(sess)
        try:
            await asyncio.wait_for(client.connect(), timeout=8)
            chat = await asyncio.wait_for(resolve_chat(client, chat_ref), timeout=10)
            if chat is not None and (getattr(chat, 'admin_rights', None) or getattr(chat, 'creator', False)):
                return sess_key(sess)
        except Exception:
            return ''
        finally:
            await client.disconnect()
        return ''
    res = await asyncio.gather(*(asyncio.wait_for(check(x), timeout=15) for x in sessions), return_exceptions=True)
    return next((r for r in res if isinstance(r, str) and r), '')


def rescan_direct(cur, conn, item_id: int, row, context):
    """Обновляет карточку без поиска по @username: по сохранённому ключу доступа или через аккаунт-админа группы."""
    from telethon.tl.types import InputPeerUser
    _, _, tg_id, access_hash, access_sess, name = row
    sessions = load_sessions(cur)
    by_key = {sess_key(x): x for x in sessions}
    attempts = []
    if access_hash and access_sess in by_key:
        peer = InputPeerUser(int(tg_id), int(access_hash))

        async def by_hash(client):
            return await client.get_entity(peer)
        attempts.append((by_key[access_sess], by_hash))
    cur.execute(f"SELECT chat, session_hash FROM {SCHEMA}.group_scan_jobs WHERE session_hash <> '' "
                f"AND mode IN ('members', 'photos') ORDER BY id DESC LIMIT 1")
    job = cur.fetchone()
    if job and job[1] in by_key and (name or '').strip():
        chat_ref, admin_key = job

        async def by_group(client):
            from telethon.tl.functions.channels import GetParticipantsRequest
            from telethon.tl.types import ChannelParticipantsSearch
            chat = await resolve_chat(client, chat_ref)
            if chat is None:
                return None
            for qtext in dict.fromkeys([name.strip(), name.strip().split()[0]]):
                res = await client(GetParticipantsRequest(chat, ChannelParticipantsSearch(qtext[:60]), 0, 200, hash=0))
                hit = next((u for u in res.users if u.id == int(tg_id)), None)
                if hit:
                    cur.execute(f"UPDATE {SCHEMA}.check_lists SET tg_access_hash={int(hit.access_hash or 0)}, "
                                f"access_session='{admin_key}' WHERE id={int(item_id)}")
                    conn.commit()
                    return hit
            return None
        attempts.append((by_key[admin_key], by_group))
    if not attempts:
        return None
    started = time.time()
    try:
        budget = context.get_remaining_time_in_millis() / 1000 - 1
    except Exception:
        budget = 4
    result = None
    for sess, finder in attempts:
        left = budget - (time.time() - started)
        if left < 3:
            break
        try:
            result = asyncio.run(asyncio.wait_for(lookup(sess, '', '', finder=finder), timeout=min(left, 20)))
        except Exception as e:
            print(f'[TG-LOOKUP] direct rescan failed: {type(e).__name__}')
            result = None
        if result and result.get('tg_id'):
            break
    if not result or not result.get('tg_id'):
        return None
    save_cache(cur, result)
    result['scan'] = apply_rescan(cur, item_id, result)
    cur.execute(f"UPDATE {SCHEMA}.check_lists SET scan_status='ok' WHERE id={int(item_id)}")
    conn.commit()
    return resp(200, {'ok': True, **result})


def handle_group(qs: dict, context) -> dict:
    raw_chat = str(qs.get('chat') or '').strip().lower()
    for pref in ('https://t.me/', 'http://t.me/', 't.me/', 'tg://chat?id=', '@'):
        if raw_chat.startswith(pref):
            raw_chat = raw_chat[len(pref):]
    if raw_chat.strip('/') in EXCLUDED_CHATS:
        return resp(200, {'ok': False, 'error': 'Это служебная группа — её не сканируем.'})
    started = time.time()
    try:
        budget = context.get_remaining_time_in_millis() / 1000 - 2
    except Exception:
        budget = 3
    deadline = started + budget
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    cols = "id, chat, title, session_hash, q_index, q_offset, status, fetched, added, skipped, total, error, mode, last_msg_id, messages"
    try:
        chat = str(qs.get('chat') or '').strip()
        want_photos = qs.get('mode') == 'photos'
        job_id = int(qs.get('job') or 0) if str(qs.get('job') or '').isdigit() else 0
        if job_id:
            cur.execute(f"SELECT {cols} FROM {SCHEMA}.group_scan_jobs WHERE id={job_id}")
        elif chat:
            mode_cond = "mode = 'photos'" if want_photos else "mode <> 'photos'"
            cur.execute(f"SELECT {cols} FROM {SCHEMA}.group_scan_jobs WHERE lower(chat)=lower('{chat.replace(chr(39), '')}') "
                        f"AND status IN ('running', 'paused') AND {mode_cond} ORDER BY id DESC LIMIT 1")
        else:
            return resp(400, {'ok': False, 'error': 'Укажите группу'})
        row = cur.fetchone()
        if not row:
            new_mode = 'photos' if want_photos else 'members'
            cur.execute(f"INSERT INTO {SCHEMA}.group_scan_jobs (chat, mode) VALUES ('{chat.replace(chr(39), '')}', '{new_mode}') RETURNING {cols}")
            row = cur.fetchone()
            conn.commit()
        job = dict(zip(cols.split(', '), row))
        if job['status'] == 'done':
            job.pop('session_hash', None)
            job['progress'] = 100
            return resp(200, {'ok': True, 'job': job})

        sessions = load_sessions(cur)
        if not job['session_hash'] and job.get('mode') != 'history':
            admin_hash = asyncio.run(find_admin_session(sessions, job['chat']))
            if admin_hash:
                job['session_hash'] = admin_hash
            elif job.get('mode') == 'photos':
                cur.execute(f"UPDATE {SCHEMA}.group_scan_jobs SET status='error', error='Нужен аккаунт-админ этой группы' WHERE id={job['id']}")
                conn.commit()
                return resp(200, {'ok': False, 'error': 'Фото можно подтянуть, только если один из ваших аккаунтов — админ этой группы.'})
            else:
                job['mode'] = 'history'
                cur.execute(f"UPDATE {SCHEMA}.group_scan_jobs SET mode='history' WHERE id={job['id']}")
                conn.commit()
        sessions.sort(key=lambda x: (0 if sess_key(x) == job['session_hash'] else 1, 0 if StringSession(x).dc_id == 2 else 1))
        result = {'error': 'no_access'}
        for sess in sessions:
            if deadline - time.time() < 6:
                break
            if job.get('mode') != 'history' and job['session_hash'] and sess_key(sess) != job['session_hash']:
                continue
            try:
                result = asyncio.run(asyncio.wait_for(group_pull(sess, job, deadline, cur, conn),
                                                      timeout=max(2, deadline - time.time())))
            except asyncio.TimeoutError:
                result = {}
            except Exception as e:
                print(f'[TG-LOOKUP] group pull failed: {type(e).__name__}: {str(e)[:150]}')
                result = {'error': type(e).__name__}
            if result.get('flood'):
                break
            if result.get('error'):
                continue
            job['session_hash'] = sess_key(sess)
            break
        status = 'done' if job['q_index'] >= len(GROUP_QUERIES) else 'running'
        err = ''
        if result.get('error') in ('no_access', 'not_admin') and not job['session_hash']:
            status, err = 'error', ('Ни один из подключённых аккаунтов не состоит в этой группе. '
                                    'Добавьте аккаунт в группу или укажите публичную ссылку @группы.')
        cur.execute(f"UPDATE {SCHEMA}.group_scan_jobs SET status='{status}', error='{err}', "
                    f"session_hash='{job['session_hash']}', updated_at=now() WHERE id={job['id']}")
        conn.commit()
        job.update({'status': status, 'error': err})
        job.pop('session_hash', None)
        job['progress'] = round(job['q_index'] / len(GROUP_QUERIES) * 100)
        return resp(200, {'ok': status != 'error', 'job': job, 'error': err})
    finally:
        cur.close()
        conn.close()


def handle_auto(context) -> dict:
    """Фоновый запуск по расписанию: сначала догружает фото участников группы, потом сканирует карточки."""
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        cur.execute(f"SELECT id FROM {SCHEMA}.group_scan_jobs WHERE status='running' AND mode='photos' "
                    f"AND updated_at < now() - interval '50 seconds' ORDER BY id LIMIT 1")
        row = cur.fetchone()
        cur.execute(f"SELECT count(*) FROM {SCHEMA}.tg_session_flood WHERE until_at > now()")
        paused = cur.fetchone()[0]
        accounts = len(load_sessions(cur))
    finally:
        cur.close()
        conn.close()
    if row:
        print(f'[TG-LOOKUP] auto: photos job {row[0]}')
        return handle_group({'job': str(row[0])}, context)
    if accounts and paused >= accounts:
        print('[TG-LOOKUP] auto: all accounts paused')
        return resp(200, {'ok': True, 'skipped': 'all paused'})
    print('[TG-LOOKUP] auto: batch')
    return handle_batch(context)


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    headers = event.get('headers') or {}
    qs = event.get('queryStringParameters') or {}
    cron = os.environ.get('CRON_SECRET', '')
    is_cron = bool(cron) and (headers.get('X-Cron-Secret') or headers.get('x-cron-secret') or qs.get('secret')) == cron
    if not is_cron and not verify_token(headers.get('X-Admin-Token') or headers.get('x-admin-token') or ''):
        return resp(401, {'error': 'Unauthorized'})
    if qs.get('action') == 'auto':
        return handle_auto(context)
    if qs.get('action') == 'batch':
        return handle_batch(context, qs.get('scope') or 'all')
    if qs.get('action') == 'group':
        return handle_group(qs, context)
    if is_cron and not qs.get('username') and not qs.get('phone') and not qs.get('rescan'):
        return resp(400, {'error': 'only batch'})

    if qs.get('action') == 'accounts':
        import accounts
        body = json.loads(event.get('body') or '{}') if event.get('httpMethod') == 'POST' else {}
        op = body.get('op') or 'list'
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        try:
            if op == 'list':
                return resp(200, accounts.list_accounts(cur))
            if op == 'delete':
                return resp(200, accounts.delete_account(cur, conn, int(body.get('id') or 0)))
            if op == 'purpose':
                return resp(200, accounts.set_purpose(cur, conn, int(body.get('id') or 0), body.get('purpose', '')))
            try:
                if op == 'logout':
                    out = asyncio.run(asyncio.wait_for(accounts.logout_account(make_client, cur, conn, int(body.get('id') or 0),
                                                                               bool(body.get('main'))), timeout=20))
                elif op == 'send_code':
                    out = asyncio.run(asyncio.wait_for(accounts.send_code(make_client, cur, conn, body.get('phone', '')), timeout=20))
                elif op == 'resend_code':
                    out = asyncio.run(asyncio.wait_for(accounts.resend_code(make_client, cur, conn, body.get('phone', '')), timeout=20))
                elif op == 'sign_in':
                    out = asyncio.run(asyncio.wait_for(accounts.sign_in(make_client, cur, conn, body.get('phone', ''),
                                                                        body.get('code', ''), body.get('password', ''),
                                                                        body.get('label', ''), body.get('purpose', 'scan')), timeout=20))
                else:
                    out = {'ok': False, 'error': 'unknown op'}
            except asyncio.TimeoutError:
                out = {'ok': False, 'error': 'Telegram не ответил вовремя, попробуйте ещё раз'}
            except Exception as e:
                n = type(e).__name__
                print(f'[TG-LOOKUP] accounts {op}: {n}: {str(e)[:200]}')
                msg = {'PhoneNumberInvalidError': 'Неверный номер телефона',
                       'PhoneNumberBannedError': 'Этот номер заблокирован в Telegram',
                       'FloodWaitError': f"Telegram просит подождать {max(1, int(getattr(e, 'seconds', 60) or 60) // 60)} мин перед новой попыткой",
                       'SendCodeUnavailableError': 'Telegram исчерпал способы отправки кода. Подождите несколько часов и запросите заново',
                       'PhoneCodeExpiredError': 'Код устарел — запросите новый',
                       'PhonePasswordFloodError': 'Слишком много попыток входа — подождите несколько часов',
                       'PhoneNumberFloodError': 'Слишком много запросов кода на этот номер — подождите несколько часов'}.get(n, f'Ошибка Telegram: {n}')
                out = {'ok': False, 'error': msg}
            return resp(200, out)
        finally:
            cur.close()
            conn.close()

    if qs.get('action') == 'proxy_test':
        import socks
        pk = proxy_kwargs().get('proxy') or {}
        out = {}
        if not isinstance(pk, dict):
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'error': 'not socks/http proxy'})}
        pt = socks.SOCKS5 if pk['proxy_type'] == 'socks5' else socks.HTTP

        def via(host, port, rdns=True, req=None):
            t0 = time.time()
            try:
                sk = socks.socksocket()
                sk.set_proxy(pt, pk['addr'], pk['port'], rdns, pk['username'], pk['password'])
                sk.settimeout(6)
                sk.connect((host, port))
                data = b''
                if req:
                    sk.sendall(req)
                    data = sk.recv(400)
                sk.close()
                return f"ok {time.time() - t0:.2f}s " + data.decode(errors='ignore')[-80:].replace('\r\n', ' ')
            except Exception as e:
                return f"{type(e).__name__}: {str(e)[:120]}"
        out['ipify_80'] = via('api.ipify.org', 80, req=b'GET / HTTP/1.0\r\nHost: api.ipify.org\r\n\r\n')
        out['tg_api_443'] = via('api.telegram.org', 443)
        for ip in ['149.154.167.51', '149.154.175.53']:
            out[f'{ip}:443'] = via(ip, 443, rdns=False)
            out[f'{ip}.sslip.io:443'] = via(f'{ip}.sslip.io', 443)
            out[f'{ip.replace(".", "-")}.nip.io:443'] = via(f'{ip.replace(".", "-")}.nip.io', 443)
        out['zws2.web.telegram.org'] = via('zws2.web.telegram.org', 443)
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(out, ensure_ascii=False)}

    if qs.get('action') == 'diag':
        import socket
        import concurrent.futures as cf
        ips = [x for x in str(qs.get('ips') or '').split(',') if x] or [
            '149.154.175.50', '149.154.175.53', '149.154.175.54', '149.154.175.55', '149.154.175.58', '149.154.175.59',
            '149.154.175.100', '149.154.175.211', '149.154.167.40', '149.154.167.41', '149.154.167.50',
            '149.154.167.51', '149.154.167.91', '149.154.167.92', '149.154.167.220', '149.154.167.222',
            '149.154.166.120', '95.161.76.100', '91.108.56.100', '91.108.56.116', '91.108.56.128',
            '91.108.56.130', '91.108.56.151', '91.108.56.165', '91.108.56.180', '91.108.56.190',
            '91.108.4.200', '91.108.8.1', '91.108.12.1', '91.108.16.1', '91.108.20.1']
        ports = [int(x) for x in str(qs.get('ports') or '443,80,5222,8443,8888').split(',')]
        targets = [(ip, p) for ip in ips for p in ports]
        def probe(t):
            t0 = time.time()
            try:
                sock = socket.create_connection(t, timeout=3)
                sock.close()
                return f"{t[0]}:{t[1]} ok {time.time() - t0:.2f}s"
            except Exception as e:
                return f"{t[0]}:{t[1]} {type(e).__name__}"
        with cf.ThreadPoolExecutor(max_workers=64) as pool:
            res = list(pool.map(probe, targets))
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        dcs = []
        for sess in load_sessions(cur)[:3]:
            try:
                ss = StringSession(sess)
                dcs.append(f"dc{ss.dc_id} {ss.server_address}:{ss.port}")
            except Exception as e:
                dcs.append(type(e).__name__)
        conn.close()
        return resp(200, {'probe': res, 'sessions': dcs})

    rescan_id = int(qs.get('rescan') or 0) if str(qs.get('rescan') or '').isdigit() else 0
    if rescan_id:
        c0 = psycopg2.connect(os.environ['DATABASE_URL'])
        k0 = c0.cursor()
        k0.execute(f"SELECT username, phone, tg_id, tg_access_hash, access_session, name FROM {SCHEMA}.check_lists WHERE id={rescan_id}")
        r0 = k0.fetchone()
        direct = None
        if r0 and r0[2]:
            direct = rescan_direct(k0, c0, rescan_id, r0, context)
        c0.close()
        if not r0:
            return resp(404, {'ok': False, 'error': 'Карточка не найдена'})
        if direct is not None:
            return direct
        qs = {'username': r0[0] or '', 'phone': '' if r0[0] else (r0[1] or '')}
    username = clean_username(qs.get('username', ''))
    phone = ''.join(ch for ch in str(qs.get('phone') or '') if ch.isdigit())
    if len(phone) == 11 and phone[0] == '8':
        phone = '7' + phone[1:]
    elif len(phone) == 10 and phone[0] == '9':
        phone = '7' + phone
    if not phone and len(username) < 4:
        return resp(400, {'ok': False, 'error': 'Укажите @username или номер телефона'})

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        sessions = load_sessions(cur, 'bot')
        if not sessions:
            return resp(200, {'ok': False, 'error': 'Нет подключённого Telegram-аккаунта'})
        result = {'error': 'Не удалось получить данные'}
        started = time.time()
        try:
            budget = context.get_remaining_time_in_millis() / 1000 - 0.8
        except Exception:
            budget = 4.2
        print(f'[TG-LOOKUP] budget {budget:.1f}s')
        cur.execute(f"SELECT session_hash FROM {SCHEMA}.tg_session_flood WHERE until_at > now()")
        blocked = {r[0] for r in cur.fetchall()}
        # Аккаунты, которые Telegram поставил на паузу, пропускаем — берём свободные.
        bot_keys = bot_session_keys(cur)
        sessions.sort(key=lambda x: (1 if sess_key(x) in blocked else 0, 0 if sess_key(x) in bot_keys else 1,
                                     0 if StringSession(x).dc_id == 2 else 1))
        used = usage_map(cur)
        tried = 0
        for s in sessions:
            left = budget - (time.time() - started)
            if left < 2.5 or tried >= 5:
                break
            if used.get(sess_key(s), 0) >= BOT_PER_HOUR:
                continue
            tried += 1
            usage_add(cur, conn, sess_key(s), 1)
            try:
                result = asyncio.run(asyncio.wait_for(lookup(s, '' if phone else username, phone), timeout=min(left, 14)))
            except (asyncio.TimeoutError, OSError, ConnectionError) as e:
                print(f'[TG-LOOKUP] session timeout: {type(e).__name__}')
                result = {'retry': True, 'error': 'timeout'}
            if result.get('flood'):
                cur.execute(f"INSERT INTO {SCHEMA}.tg_session_flood (session_hash, until_at) VALUES "
                            f"('{sess_key(s)}', now() + interval '{int(result['flood']) + 30} seconds') "
                            f"ON CONFLICT (session_hash) DO UPDATE SET until_at = EXCLUDED.until_at")
                conn.commit()
            if not result.get('retry'):
                break
        if result.get('error') == 'FloodWaitError':
            result['error'] = ('Telegram временно ограничил поиск у всех подключённых аккаунтов. '
                               'Попробуйте позже или подключите ещё аккаунты.')
        if not result.get('tg_id'):
            err = result.get('error', 'Не найдено')
            if err == 'timeout':
                err = ('Сервер не может подключиться к Telegram. Нужен прокси: добавьте секрет TG_PROXY'
                       if not os.environ.get('TG_PROXY') else 'Прокси TG_PROXY не отвечает — проверьте его данные')
            return resp(200, {'ok': False, 'error': err, 'budget': round(budget, 1)})
        save_cache(cur, result)
        if rescan_id:
            result['scan'] = apply_rescan(cur, rescan_id, result)
        conn.commit()
        return resp(200, {'ok': True, **result})
    finally:
        cur.close()
        conn.close()
