-- Помечаем зависших неоплативших водителей (paying с просроченным дедлайном) как expired.
UPDATE t_p67171637_yug_transfer_prize_l.order_queue q
SET status = 'expired'
FROM t_p67171637_yug_transfer_prize_l.dispatch_orders d
WHERE q.order_id = d.id
  AND q.status = 'paying'
  AND d.sale_status = 'selling'
  AND d.current_deadline IS NOT NULL
  AND d.current_deadline < NOW();

-- Сбрасываем текущего плательщика у этих заказов, чтобы очередь могла идти дальше.
UPDATE t_p67171637_yug_transfer_prize_l.dispatch_orders d
SET current_user_id = NULL, current_deadline = NULL
WHERE d.sale_status = 'selling'
  AND d.current_deadline IS NOT NULL
  AND d.current_deadline < NOW();