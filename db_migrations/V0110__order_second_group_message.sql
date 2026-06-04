ALTER TABLE t_p67171637_yug_transfer_prize_l.dispatch_orders
  ADD COLUMN IF NOT EXISTS tg_chat_id2 TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS tg_message_id2 BIGINT;