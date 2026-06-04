ALTER TABLE t_p67171637_yug_transfer_prize_l.order_queue
  ADD COLUMN IF NOT EXISTS pay_msg_id BIGINT,
  ADD COLUMN IF NOT EXISTS pay_chat_id BIGINT;