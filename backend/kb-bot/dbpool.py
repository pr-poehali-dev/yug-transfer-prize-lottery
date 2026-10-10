"""Одно переиспользуемое подключение к БД вместо нового на каждый запрос."""
import os
import time
import threading
import psycopg2

_real_connect = psycopg2.connect
_main = threading.main_thread()
_state = {'conn': None, 'used': 0.0, 'depth': 0}


class _Shared:
    def __init__(self, conn):
        self._c = conn
        self._closed = False

    def __getattr__(self, name):
        return getattr(self._c, name)

    def __setattr__(self, name, value):
        if name in ('_c', '_closed'):
            object.__setattr__(self, name, value)
        else:
            setattr(self._c, name, value)

    def close(self):
        if self._closed:
            return
        self._closed = True
        _state['depth'] = max(0, _state['depth'] - 1)
        if _state['depth'] > 0:
            return
        try:
            if self._c.closed:
                return
            if self._c.get_transaction_status() != psycopg2.extensions.TRANSACTION_STATUS_IDLE:
                self._c.rollback()
        except Exception:
            _drop()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, *a):
        if exc_type:
            self._c.rollback()
        else:
            self._c.commit()
        return False


def _drop():
    c = _state['conn']
    _state['conn'] = None
    try:
        if c is not None:
            c.close()
    except Exception:
        pass


def _alive(c) -> bool:
    if c is None or c.closed:
        return False
    if time.time() - _state['used'] < 30:
        return True
    try:
        cur = c.cursor()
        cur.execute('SELECT 1')
        cur.fetchone()
        cur.close()
        c.rollback()
        return True
    except Exception:
        return False


def connect(dsn=None, *args, **kwargs):
    if threading.current_thread() is not _main or args or kwargs or (dsn and dsn != os.environ.get('DATABASE_URL')):
        return _real_connect(dsn, *args, **kwargs)
    if not _alive(_state['conn']):
        _drop()
        _state['conn'] = _real_connect(os.environ['DATABASE_URL'])
    _state['used'] = time.time()
    _state['depth'] += 1
    return _Shared(_state['conn'])


def reset() -> None:
    """В начале каждого запроса: сбрасываем незакрытые транзакции прошлого вызова."""
    _state['depth'] = 0
    c = _state['conn']
    try:
        if c is not None and not c.closed and c.get_transaction_status() != psycopg2.extensions.TRANSACTION_STATUS_IDLE:
            c.rollback()
    except Exception:
        _drop()


def install() -> None:
    psycopg2.connect = connect
