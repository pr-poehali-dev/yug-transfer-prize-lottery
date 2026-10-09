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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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


def load_sessions(cur) -> list:
    cur.execute(f"SELECT session_string FROM {SCHEMA}.tg_user_accounts "
                f"WHERE coalesce(session_string, '') <> '' AND NOT coalesce(is_banned, FALSE) "
                f"ORDER BY is_active DESC, last_used_at DESC NULLS LAST")
    sessions = [r[0] for r in cur.fetchall()]
    cur.execute(f"SELECT session_string FROM {SCHEMA}.tg_user_session WHERE coalesce(session_string, '') <> ''")
    sessions += [r[0] for r in cur.fetchall()]
    return sessions


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


async def lookup(session: str, username: str, phone: str = '') -> dict:
    t0 = time.time()
    client = make_client(session)
    await client.connect()
    print(f'[TG-LOOKUP] connected in {time.time() - t0:.2f}s')
    try:
        if not await client.is_user_authorized():
            return {'retry': True, 'error': 'session not authorized'}
        if phone:
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
            cur.execute(f"UPDATE {SCHEMA}.check_lists SET {', '.join(sets)} WHERE id={int(row_id)}")
            conn.commit()
            stats['done'] += 1
    finally:
        await client.disconnect()
    return stats


def handle_batch(context) -> dict:
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
        print(f'[TG-LOOKUP] batch sessions {len(sessions)}, blocked {len(blocked)}')
        workers = sessions[:4]
        cur.execute(f"SELECT id, username FROM {SCHEMA}.check_lists WHERE list_type='pending' AND username <> '' "
                    f"AND last_scan_at IS NULL ORDER BY id DESC LIMIT {12 * max(1, len(workers))}")
        rows = cur.fetchall()
        stats = [{'done': 0, 'found': 0, 'missing': 0, 'flood': 0} for _ in workers]

        async def run_all():
            async def one(i, sess):
                try:
                    await asyncio.wait_for(batch_scan(sess, rows[i::len(workers)], deadline, cur, conn, stats[i]),
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
            for k in total:
                total[k] += st.get(k, 0)
            if st.get('flood') and not st.get('cut'):
                cur.execute(f"INSERT INTO {SCHEMA}.tg_session_flood (session_hash, until_at) VALUES "
                            f"('{sess_key(sess)}', now() + interval '{int(st['flood']) + 30} seconds') "
                            f"ON CONFLICT (session_hash) DO UPDATE SET until_at = EXCLUDED.until_at")
                conn.commit()
        cur.execute(f"SELECT count(*) FROM {SCHEMA}.check_lists WHERE list_type='pending' AND username <> '' AND last_scan_at IS NULL")
        left = cur.fetchone()[0]
        cur.execute(f"SELECT count(*) FROM {SCHEMA}.tg_session_flood WHERE until_at > now()")
        paused = cur.fetchone()[0]
        return resp(200, {'ok': True, **total, 'left': left, 'accounts': len(load_sessions(cur)), 'paused': paused})
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


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    headers = event.get('headers') or {}
    qs = event.get('queryStringParameters') or {}
    cron = os.environ.get('CRON_SECRET', '')
    is_cron = bool(cron) and (headers.get('X-Cron-Secret') or headers.get('x-cron-secret') or qs.get('secret')) == cron
    if not is_cron and not verify_token(headers.get('X-Admin-Token') or headers.get('x-admin-token') or ''):
        return resp(401, {'error': 'Unauthorized'})
    if qs.get('action') == 'batch':
        return handle_batch(context)
    if is_cron:
        return resp(400, {'error': 'only batch'})

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
        k0.execute(f"SELECT username, phone FROM {SCHEMA}.check_lists WHERE id={rescan_id}")
        r0 = k0.fetchone()
        c0.close()
        if not r0:
            return resp(404, {'ok': False, 'error': 'Карточка не найдена'})
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
        sessions = load_sessions(cur)
        if not sessions:
            return resp(200, {'ok': False, 'error': 'Нет подключённого Telegram-аккаунта'})
        result = {'error': 'Не удалось получить данные'}
        started = time.time()
        try:
            budget = context.get_remaining_time_in_millis() / 1000 - 0.8
        except Exception:
            budget = 4.2
        print(f'[TG-LOOKUP] budget {budget:.1f}s')
        sessions.sort(key=lambda x: 0 if StringSession(x).dc_id == 2 else 1)
        for s in sessions[:3]:
            left = budget - (time.time() - started)
            if left < 1.5:
                break
            try:
                result = asyncio.run(asyncio.wait_for(lookup(s, '' if phone else username, phone), timeout=left))
            except (asyncio.TimeoutError, OSError, ConnectionError) as e:
                print(f'[TG-LOOKUP] session timeout: {type(e).__name__}')
                result = {'retry': True, 'error': 'timeout'}
            if not result.get('retry'):
                break
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
