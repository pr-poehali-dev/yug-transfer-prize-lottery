ALTER TABLE t_p67171637_yug_transfer_prize_l.check_lists ADD COLUMN IF NOT EXISTS tg_access_hash BIGINT;
ALTER TABLE t_p67171637_yug_transfer_prize_l.check_lists ADD COLUMN IF NOT EXISTS access_session TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_check_lists_scan_queue ON t_p67171637_yug_transfer_prize_l.check_lists (list_type, last_scan_at) WHERE last_scan_at IS NULL;