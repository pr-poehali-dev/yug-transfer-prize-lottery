UPDATE t_p67171637_yug_transfer_prize_l.dispatch_orders
SET sale_status = 'no_cars', current_user_id = NULL, current_deadline = NULL
WHERE id = 16 AND sale_status = 'selling'
  AND order_date = '2026-07-07' AND order_time = '07:00';