"""Автономная рассылка приглашений по расписанию.
Вызывается таймером — работает без открытой вкладки браузера.
Делает несколько приглашений за вызов, соблюдая паузы и лимиты аккаунтов.
"""
import json
import asyncio

import core


def resp(status: int, body: dict) -> dict:
    return {
        'statusCode': status,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'isBase64Encoded': False,
        'body': json.dumps(body, ensure_ascii=False, default=str),
    }


def handler(event: dict, context) -> dict:
    """Делает очередную порцию приглашений, если рассылка включена."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }, 'body': ''}

    state = core.run_state()
    if not state.get('is_active'):
        return resp(200, {'ok': True, 'skipped': 'рассылка выключена'})
    if not state.get('pending'):
        return resp(200, {'ok': True, 'skipped': 'очередь пуста'})
    if not state.get('capacity_today'):
        return resp(200, {'ok': True, 'skipped': 'лимиты на сегодня исчерпаны'})

    try:
        result = core.run_async(core.invite_batch(3, budget=15.0))
    except asyncio.TimeoutError:
        core.note('Telegram не ответил, повторим в следующий заход')
        return resp(200, {'ok': True, 'skipped': 'нет связи с Telegram'})
    except Exception as e:
        core.note(f'Сбой: {str(e)[:150]}')
        return resp(200, {'ok': True, 'error': str(e)[:200]})
    return resp(200, {'ok': True, 'batch': result.get('batch'),
                      'done': core.run_state().get('done')})