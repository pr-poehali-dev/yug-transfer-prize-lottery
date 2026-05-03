ALTER TABLE t_p67171637_yug_transfer_prize_l.excluded_settings
  ADD COLUMN IF NOT EXISTS loop_token TEXT,
  ADD COLUMN IF NOT EXISTS loop_heartbeat TIMESTAMP;