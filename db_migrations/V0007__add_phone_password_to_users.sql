ALTER TABLE t_p67171637_yug_transfer_prize_l.users
  ADD COLUMN IF NOT EXISTS phone varchar(20) UNIQUE,
  ADD COLUMN IF NOT EXISTS password_hash varchar(255);

ALTER TABLE t_p67171637_yug_transfer_prize_l.users
  ALTER COLUMN telegram_id SET DEFAULT 0;