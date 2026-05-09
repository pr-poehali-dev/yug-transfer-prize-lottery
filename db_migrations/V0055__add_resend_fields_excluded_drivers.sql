ALTER TABLE t_p67171637_yug_transfer_prize_l.excluded_drivers
  ADD COLUMN IF NOT EXISTS resend_queued boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS resend_status text,
  ADD COLUMN IF NOT EXISTS resend_at timestamp without time zone;