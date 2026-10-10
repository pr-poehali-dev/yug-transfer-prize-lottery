ALTER TABLE t_p67171637_yug_transfer_prize_l.kb_payments ADD COLUMN IF NOT EXISTS chat_id BIGINT NULL;
ALTER TABLE t_p67171637_yug_transfer_prize_l.kb_payments ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT '';
ALTER TABLE t_p67171637_yug_transfer_prize_l.kb_payments ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP NULL;
ALTER TABLE t_p67171637_yug_transfer_prize_l.kb_payments ADD COLUMN IF NOT EXISTS paid_until TIMESTAMP NULL;
CREATE INDEX IF NOT EXISTS kb_payments_payment_id_idx ON t_p67171637_yug_transfer_prize_l.kb_payments (payment_id);
ALTER TABLE t_p67171637_yug_transfer_prize_l.kb_subscriptions ADD COLUMN IF NOT EXISTS reminded_until TIMESTAMP NULL;