"""
Публичная статистика сайта: кол-во участников, победителей, сумма призов.
"""
import os
import json
import psycopg2


CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()

    # Всего зарегистрированных пользователей
    cur.execute(f"SELECT COUNT(*) FROM {schema}.users")
    total_users = cur.fetchone()[0]

    # Активных розыгрышей
    cur.execute(f"SELECT COUNT(*) FROM {schema}.raffles WHERE status = 'active'")
    active_raffles = cur.fetchone()[0]

    # Завершённых розыгрышей (победители)
    cur.execute(f"SELECT COUNT(*) FROM {schema}.raffles WHERE status = 'ended' AND winner IS NOT NULL AND winner != ''")
    winners = cur.fetchone()[0]

    # Сумма всех минимальных взносов * участников (приблизительная выручка)
    cur.execute(f"SELECT COALESCE(SUM(min_amount * participants), 0) FROM {schema}.raffles")
    total_prizes = cur.fetchone()[0]

    # Всего участников во всех розыгрышах
    cur.execute(f"SELECT COALESCE(SUM(participants), 0) FROM {schema}.raffles")
    total_participants = cur.fetchone()[0]

    cur.close()
    conn.close()

    return {
        'statusCode': 200,
        'headers': CORS,
        'body': json.dumps({
            'ok': True,
            'users': total_users,
            'participants': total_participants,
            'winners': winners,
            'active_raffles': active_raffles,
            'total_prizes': total_prizes,
        }),
    }
