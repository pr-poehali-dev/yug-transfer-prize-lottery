-- Поля для механики очереди в заказах диспетчерской
ALTER TABLE t_p67171637_yug_transfer_prize_l.dispatch_orders
  ADD COLUMN IF NOT EXISTS commission_rub NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tg_chat_id TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS tg_message_id BIGINT,
  ADD COLUMN IF NOT EXISTS sale_status TEXT DEFAULT 'archived',
  ADD COLUMN IF NOT EXISTS current_user_id BIGINT,
  ADD COLUMN IF NOT EXISTS current_deadline TIMESTAMP,
  ADD COLUMN IF NOT EXISTS winner_user_id BIGINT;

-- Очередь участников по заказу
CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.order_queue (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  tg_user_id BIGINT NOT NULL,
  username TEXT DEFAULT '',
  first_name TEXT DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'waiting',
  payment_id TEXT DEFAULT '',
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (order_id, tg_user_id)
);

CREATE INDEX IF NOT EXISTS idx_order_queue_order ON t_p67171637_yug_transfer_prize_l.order_queue (order_id, position);
CREATE INDEX IF NOT EXISTS idx_order_queue_payment ON t_p67171637_yug_transfer_prize_l.order_queue (payment_id);