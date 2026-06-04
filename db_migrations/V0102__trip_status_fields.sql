ALTER TABLE t_p67171637_yug_transfer_prize_l.dispatch_orders
  ADD COLUMN IF NOT EXISTS trip_status TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS winner_chat_id BIGINT,
  ADD COLUMN IF NOT EXISTS winner_message_id BIGINT;