"""
Перенос фото и файлов: скачивает все картинки, на которые ссылается база, в свою папку
и меняет ссылки в базе на новый адрес.

  python server/restore_files.py download   — скачать файлы в FILES_DIR (по умолчанию ./uploads)
  python server/restore_files.py upload     — залить скачанные файлы в новое S3-хранилище (S3_ENDPOINT)
  python server/restore_files.py relink     — заменить в базе старые ссылки на FILES_PUBLIC_URL
"""
import os
import re
import sys
import concurrent.futures
from pathlib import Path

import psycopg2
import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / '.env')
SCHEMA = 't_p67171637_yug_transfer_prize_l'
OLD = re.compile(r'https://cdn\.poehali\.dev/projects/[A-Za-z0-9-]+/(?:bucket|files)/')
OLD_SQL = r'https://cdn\.poehali\.dev/projects/[A-Za-z0-9-]+/(bucket|files)/'
DIR = Path(os.environ.get('FILES_DIR', ROOT / 'uploads'))


def text_columns(cur):
    cur.execute(f"SELECT table_name, column_name, data_type FROM information_schema.columns "
                f"WHERE table_schema='{SCHEMA}' AND data_type IN ('text','character varying','jsonb','ARRAY')")
    return cur.fetchall()


def collect(cur):
    urls = set()
    for t, c, typ in text_columns(cur):
        expr = f'"{c}"::text'
        cur.execute(f"SELECT {expr} FROM {SCHEMA}.{t} WHERE {expr} LIKE '%%cdn.poehali.dev/projects/%%'")
        for (v,) in cur.fetchall():
            urls.update(re.findall(r'https://cdn\.poehali\.dev/projects/[A-Za-z0-9-]+/(?:bucket|files)/[^\s"\'\\,}\]]+', v or ''))
    return urls


def fetch(url):
    rel = OLD.sub('', url)
    dst = DIR / rel
    if dst.exists() and dst.stat().st_size:
        return 'skip'
    dst.parent.mkdir(parents=True, exist_ok=True)
    for _ in range(3):
        try:
            r = requests.get(url, timeout=30)
            if r.status_code == 200:
                dst.write_bytes(r.content)
                return 'ok'
            if r.status_code == 404:
                return 'missing'
        except Exception:
            pass
    return 'fail'


def download():
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    urls = sorted(collect(conn.cursor()))
    conn.close()
    print(f'Файлов к скачиванию: {len(urls)} -> {DIR}')
    stats = {}
    with concurrent.futures.ThreadPoolExecutor(16) as ex:
        for i, res in enumerate(ex.map(fetch, urls), 1):
            stats[res] = stats.get(res, 0) + 1
            if i % 500 == 0:
                print(i, stats, flush=True)
    print('Готово:', stats)


def upload():
    import boto3
    s3 = boto3.client('s3', endpoint_url=os.environ['S3_ENDPOINT'],
                      aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
                      aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'])
    bucket = os.environ.get('S3_BUCKET', 'files')
    files = [p for p in DIR.rglob('*') if p.is_file()]
    print(f'Загружаю {len(files)} файлов в {bucket}')

    def put(p):
        key = p.relative_to(DIR).as_posix()
        ctype = {'.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4'}.get(p.suffix.lower(), 'image/jpeg')
        s3.put_object(Bucket=bucket, Key=key, Body=p.read_bytes(), ContentType=ctype)

    with concurrent.futures.ThreadPoolExecutor(16) as ex:
        for i, _ in enumerate(ex.map(put, files), 1):
            if i % 1000 == 0:
                print(i, flush=True)
    print('Готово')


def relink():
    new = os.environ['FILES_PUBLIC_URL'].rstrip('/') + '/'
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    for t, c, typ in text_columns(cur):
        if typ == 'ARRAY':
            continue
        if typ == 'jsonb':
            sql = (f"UPDATE {SCHEMA}.{t} SET \"{c}\" = regexp_replace(\"{c}\"::text, %s, %s, 'g')::jsonb "
                   f"WHERE \"{c}\"::text LIKE '%%cdn.poehali.dev/projects/%%'")
        else:
            sql = (f"UPDATE {SCHEMA}.{t} SET \"{c}\" = regexp_replace(\"{c}\", %s, %s, 'g') "
                   f"WHERE \"{c}\" LIKE '%%cdn.poehali.dev/projects/%%'")
        cur.execute(sql, (OLD_SQL, new))
        if cur.rowcount:
            print(f'{t}.{c}: {cur.rowcount}')
    conn.commit()
    conn.close()
    print('Ссылки обновлены на', new)


if __name__ == '__main__':
    {'download': download, 'upload': upload, 'relink': relink}[sys.argv[1] if len(sys.argv) > 1 else 'download']()
