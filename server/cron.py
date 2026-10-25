"""
Задачи по расписанию вместо облачного планировщика.
Запуск из crontab:  * * * * *  cd /opt/baza && venv/bin/python server/cron.py every_minute
                    0 6 * * *  cd /opt/baza && venv/bin/python server/cron.py daily
"""
import hashlib
import os
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / '.env')
BASE = os.environ.get('API_INTERNAL', 'http://127.0.0.1:8000/api').rstrip('/')
CRON = {'X-Cron-Secret': os.environ.get('CRON_SECRET', '')}
ADMIN = {'X-Admin-Token': hashlib.sha256(
    f"{os.environ.get('ADMIN_LOGIN', '')}:{os.environ.get('ADMIN_PASSWORD', '')}:admin_secret_2026".encode()).hexdigest()}


def hit(method, path, headers, timeout=120):
    try:
        r = requests.request(method, f'{BASE}/{path}', headers=headers, timeout=timeout)
        print(path, r.status_code, r.text[:200])
    except Exception as e:
        print(path, 'ERROR', type(e).__name__, e)


if __name__ == '__main__':
    job = sys.argv[1] if len(sys.argv) > 1 else 'every_minute'
    if job == 'every_minute':
        hit('POST', 'admin-posts?action=check_scheduled', ADMIN)
        hit('GET', 'tg-lookup?action=bg_status', ADMIN)
    elif job == 'scan':
        hit('GET', 'tg-lookup?action=auto', CRON, timeout=600)
    elif job == 'daily':
        hit('GET', 'kb-bot?action=daily_scan', CRON, timeout=600)
