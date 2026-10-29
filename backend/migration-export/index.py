"""
Временная выгрузка для переноса проекта: структура и данные базы, загрузка готовой копии в хранилище.
Удаляется сразу после переноса.
"""
import os
import json
import base64
import datetime
import decimal
import psycopg2
import boto3

TOKEN = '7c1e9a4f2b8d6035e1a9c47f0b2d8e63a5f1c9d047b2e8a6'
SCHEMA = 't_p67171637_yug_transfer_prize_l'
CORS = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Export-Token'}


def enc(v):
    if isinstance(v, (datetime.datetime, datetime.date, datetime.time)):
        return {'$t': v.isoformat()}
    if isinstance(v, decimal.Decimal):
        return {'$d': str(v)}
    if isinstance(v, (bytes, memoryview)):
        return {'$b': base64.b64encode(bytes(v)).decode()}
    if isinstance(v, datetime.timedelta):
        return {'$i': f'{v.total_seconds()} seconds'}
    return v


def resp(code, body):
    return {'statusCode': code, 'headers': {**CORS, 'Content-Type': 'application/json'},
            'body': json.dumps(body, ensure_ascii=False, default=str)}


def s3c():
    return boto3.client('s3', endpoint_url='https://bucket.poehali.dev',
                        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
                        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'])


def schema_info(cur):
    cur.execute(f"SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default "
                f"FROM information_schema.columns WHERE table_schema='{SCHEMA}' ORDER BY table_name, ordinal_position")
    tables = {}
    for r in cur.fetchall():
        tables.setdefault(r[0], []).append({'name': r[1], 'type': r[2], 'udt': r[3], 'nullable': r[4], 'default': r[5]})
    cur.execute(f"SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='{SCHEMA}' ORDER BY 1, 2")
    idx = [{'table': r[0], 'name': r[1], 'def': r[2]} for r in cur.fetchall()]
    cur.execute(f"SELECT tc.table_name, tc.constraint_name, tc.constraint_type, kcu.column_name, ccu.table_name, ccu.column_name "
                f"FROM information_schema.table_constraints tc "
                f"LEFT JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=tc.constraint_name AND kcu.table_schema=tc.table_schema "
                f"LEFT JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name AND ccu.table_schema=tc.table_schema "
                f"WHERE tc.table_schema='{SCHEMA}' AND tc.constraint_type IN ('PRIMARY KEY','UNIQUE','FOREIGN KEY') "
                f"ORDER BY 1, 2, kcu.ordinal_position")
    cons = [{'table': r[0], 'name': r[1], 'type': r[2], 'column': r[3], 'ref_table': r[4], 'ref_column': r[5]} for r in cur.fetchall()]
    return {'tables': [{'table': t, 'columns': c} for t, c in tables.items()], 'indexes': idx, 'constraints': cons}


def handler(event: dict, context) -> dict:
    """Отдаёт структуру базы и строки таблиц порциями, собирает готовую копию в хранилище для скачивания."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}
    h = event.get('headers') or {}
    if (h.get('X-Export-Token') or h.get('x-export-token')) != TOKEN:
        return resp(401, {'error': 'Unauthorized'})
    qs = event.get('queryStringParameters') or {}
    action = qs.get('action', 'schema')

    if action in ('put_part', 'join'):
        s3 = s3c()
        name = ''.join(ch for ch in qs.get('name', '') if ch.isalnum() or ch in '-_.')
        if action == 'put_part':
            body = json.loads(event.get('body') or '{}')
            s3.put_object(Bucket='files', Key=f"export-parts/{name}.{int(qs.get('n', 0)):03d}",
                          Body=base64.b64decode(body['data']))
            return resp(200, {'ok': True})
        parts = int(qs.get('parts', 0))
        data = b''.join(s3.get_object(Bucket='files', Key=f"export-parts/{name}.{i:03d}")['Body'].read() for i in range(parts))
        key = f"export/{name}"
        s3.put_object(Bucket='files', Key=key, Body=data, ContentType=qs.get('ctype') or 'application/gzip')
        for i in range(parts):
            s3.delete_object(Bucket='files', Key=f"export-parts/{name}.{i:03d}")
        return resp(200, {'ok': True, 'size': len(data),
                          'url': f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"})

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        if action == 'schema':
            return resp(200, schema_info(cur))
        if action == 'rows':
            t = ''.join(ch for ch in qs.get('table', '') if ch.isalnum() or ch == '_')
            off = int(qs.get('offset', 0))
            lim = min(int(qs.get('limit', 2000)), 10000)
            cur.execute(f"SELECT k.column_name FROM information_schema.table_constraints c "
                        f"JOIN information_schema.key_column_usage k ON k.constraint_name=c.constraint_name "
                        f"AND k.table_schema=c.table_schema WHERE c.table_schema='{SCHEMA}' AND c.table_name='{t}' "
                        f"AND c.constraint_type='PRIMARY KEY' ORDER BY k.ordinal_position")
            pk = ', '.join(f'"{r[0]}"' for r in cur.fetchall()) or '1'
            cur.execute(f"SELECT * FROM {SCHEMA}.{t} ORDER BY {pk} LIMIT {lim} OFFSET {off}")
            cols = [d[0] for d in cur.description]
            rows = [[enc(v) for v in r] for r in cur.fetchall()]
            return resp(200, {'columns': cols, 'rows': rows})
        if action == 'counts':
            cur.execute(f"SELECT table_name FROM information_schema.tables WHERE table_schema='{SCHEMA}' AND table_type='BASE TABLE'")
            out = {}
            for (t,) in cur.fetchall():
                cur.execute(f"SELECT count(*) FROM {SCHEMA}.{t}")
                out[t] = cur.fetchone()[0]
            return resp(200, out)
        return resp(400, {'error': 'unknown action'})
    finally:
        cur.close()
        conn.close()
