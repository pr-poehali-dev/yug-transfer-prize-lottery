"""
Запуск серверных функций проекта на своём сервере (VPS).
Каждая папка backend/<имя> становится адресом /api/<имя>.
"""
import base64
import importlib.util
import os
import sys
import threading
import time
import uuid
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, Response, request

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / '.env')
BACKEND = ROOT / 'backend'
TIMEOUT = int(os.environ.get('FUNCTION_TIMEOUT', '60'))
SKIP = {'migration-export'}

app = Flask(__name__)
_modules: dict = {}
_lock = threading.Lock()


class Context:
    """Аналог context облачной функции: id запроса и оставшееся время."""

    def __init__(self, name: str):
        self.request_id = uuid.uuid4().hex
        self.function_name = name
        self._deadline = time.time() + TIMEOUT

    def get_remaining_time_in_millis(self) -> int:
        return max(0, int((self._deadline - time.time()) * 1000))


def load(name: str):
    with _lock:
        if name in _modules:
            return _modules[name]
        folder = BACKEND / name
        if name in SKIP or not (folder / 'index.py').is_file():
            return None
        if str(folder) not in sys.path:
            sys.path.append(str(folder))
        spec = importlib.util.spec_from_file_location(f'fn_{name.replace("-", "_")}', folder / 'index.py')
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        _modules[name] = mod
        return mod


def to_event(name: str) -> dict:
    headers = {k: v for k, v in request.headers.items()}
    if 'Authorization' in headers:
        headers['X-Authorization'] = headers['Authorization']
    if 'Cookie' in headers:
        headers['X-Cookie'] = headers['Cookie']
    raw = request.get_data()
    try:
        body, b64 = raw.decode('utf-8'), False
    except UnicodeDecodeError:
        body, b64 = base64.b64encode(raw).decode(), True
    ip = request.headers.get('X-Real-IP') or request.headers.get('X-Forwarded-For', '').split(',')[0].strip() or request.remote_addr
    return {
        'httpMethod': request.method,
        'headers': headers,
        'queryStringParameters': {k: v for k, v in request.args.items()},
        'body': body,
        'isBase64Encoded': b64,
        'path': request.path,
        'requestContext': {'identity': {'sourceIp': ip}, 'requestId': uuid.uuid4().hex},
    }


@app.route('/api/<name>', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'])
@app.route('/api/<name>/', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'])
def call(name: str):
    mod = load(name)
    if mod is None:
        return Response('{"error":"not found"}', 404, content_type='application/json')
    result = mod.handler(to_event(name), Context(name)) or {}
    body = result.get('body', '')
    if result.get('isBase64Encoded'):
        body = base64.b64decode(body)
    elif not isinstance(body, (str, bytes)):
        import json
        body = json.dumps(body, ensure_ascii=False)
    resp = Response(body, status=int(result.get('statusCode', 200)))
    for k, v in (result.get('headers') or {}).items():
        if k.lower() == 'x-set-cookie':
            resp.headers.add('Set-Cookie', v)
        else:
            resp.headers[k] = str(v)
    if 'Access-Control-Allow-Origin' not in resp.headers:
        resp.headers['Access-Control-Allow-Origin'] = '*'
    return resp


@app.route('/api/health')
def health():
    return {'ok': True, 'functions': sorted(p.name for p in BACKEND.iterdir() if (p / 'index.py').is_file() and p.name not in SKIP)}


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', '8000')))
