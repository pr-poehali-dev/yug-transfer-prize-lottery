"""Подключение Telegram-аккаунтов для сканера: список, вход по коду из Telegram, удаление."""
import hashlib
from telethon.sessions import StringSession

SCHEMA = 't_p67171637_yug_transfer_prize_l'


def _q(v) -> str:
    return str(v or '').replace("'", "''")


def _phone(v: str) -> str:
    d = ''.join(ch for ch in str(v or '') if ch.isdigit())
    if len(d) == 11 and d[0] == '8':
        d = '7' + d[1:]
    return '+' + d if d else ''


def _key(session: str) -> str:
    return hashlib.sha256(session.encode()).hexdigest()[:24]


def list_accounts(cur) -> dict:
    cur.execute(f"SELECT session_hash, until_at FROM {SCHEMA}.tg_session_flood WHERE until_at > now()")
    flood = {r[0]: r[1] for r in cur.fetchall()}
    cur.execute(f"SELECT id, label, phone, session_string, is_banned, last_used_at, created_at "
                f"FROM {SCHEMA}.tg_user_accounts ORDER BY id")
    items = []
    for r in cur.fetchall():
        k = _key(r[3] or '')
        items.append({'id': r[0], 'label': r[1], 'phone': r[2] or '', 'banned': bool(r[4]),
                      'paused_until': flood.get(k), 'last_used_at': r[5], 'created_at': r[6]})
    cur.execute(f"SELECT session_string FROM {SCHEMA}.tg_user_session WHERE coalesce(session_string,'') <> ''")
    main = [r[0] for r in cur.fetchall()]
    for i, s in enumerate(main):
        items.insert(i, {'id': 0, 'label': 'Основной аккаунт', 'phone': '', 'banned': False,
                         'paused_until': flood.get(_key(s)), 'main': True})
    return {'ok': True, 'items': items}


async def send_code(make_client, cur, conn, phone_raw: str) -> dict:
    phone = _phone(phone_raw)
    if len(phone) < 11:
        return {'ok': False, 'error': 'Введите номер телефона полностью'}
    cur.execute(f"SELECT 1 FROM {SCHEMA}.tg_user_accounts WHERE phone='{_q(phone)}'")
    if cur.fetchone():
        return {'ok': False, 'error': 'Этот аккаунт уже подключён'}
    client = make_client('')
    await client.connect()
    try:
        sent = await client.send_code_request(phone)
        sess = client.session.save()
    finally:
        await client.disconnect()
    cur.execute(f"INSERT INTO {SCHEMA}.tg_login_pending (phone, session_string, phone_code_hash) "
                f"VALUES ('{_q(phone)}', '{_q(sess)}', '{_q(sent.phone_code_hash)}') "
                f"ON CONFLICT (phone) DO UPDATE SET session_string=EXCLUDED.session_string, "
                f"phone_code_hash=EXCLUDED.phone_code_hash, created_at=now()")
    conn.commit()
    return {'ok': True, 'phone': phone}


async def sign_in(make_client, cur, conn, phone_raw: str, code: str, password: str, label: str) -> dict:
    from telethon.errors import SessionPasswordNeededError, PhoneCodeInvalidError, PhoneCodeExpiredError, PasswordHashInvalidError
    phone = _phone(phone_raw)
    cur.execute(f"SELECT session_string, phone_code_hash FROM {SCHEMA}.tg_login_pending WHERE phone='{_q(phone)}'")
    row = cur.fetchone()
    if not row:
        return {'ok': False, 'error': 'Сначала запросите код'}
    client = make_client(row[0])
    await client.connect()
    try:
        try:
            if password and not code:
                await client.sign_in(password=password)
            else:
                await client.sign_in(phone=phone, code=str(code).strip(), phone_code_hash=row[1])
        except SessionPasswordNeededError:
            if not password:
                cur.execute(f"UPDATE {SCHEMA}.tg_login_pending SET session_string='{_q(client.session.save())}' "
                            f"WHERE phone='{_q(phone)}'")
                conn.commit()
                return {'ok': False, 'need_password': True, 'error': 'На аккаунте включён облачный пароль — введите его'}
            await client.sign_in(password=password)
        except PhoneCodeInvalidError:
            return {'ok': False, 'error': 'Неверный код'}
        except PhoneCodeExpiredError:
            return {'ok': False, 'error': 'Код устарел — запросите новый'}
        except PasswordHashInvalidError:
            return {'ok': False, 'need_password': True, 'error': 'Неверный облачный пароль'}
        me = await client.get_me()
        sess = client.session.save()
    finally:
        await client.disconnect()
    name = ' '.join(x for x in [me.first_name or '', me.last_name or ''] if x).strip()
    title = label.strip() or name or phone
    if me.username:
        title += f' (@{me.username})'
    cur.execute(f"INSERT INTO {SCHEMA}.tg_user_accounts (label, phone, session_string, is_active, needs_warmup) "
                f"VALUES ('{_q(title)}', '{_q(phone)}', '{_q(sess)}', TRUE, FALSE)")
    cur.execute(f"DELETE FROM {SCHEMA}.tg_login_pending WHERE phone='{_q(phone)}'")
    conn.commit()
    return {'ok': True, 'label': title}


def delete_account(cur, conn, acc_id: int) -> dict:
    cur.execute(f"DELETE FROM {SCHEMA}.tg_user_accounts WHERE id={int(acc_id)}")
    conn.commit()
    return {'ok': True}


def check_session(session: str) -> StringSession:
    return StringSession(session)
