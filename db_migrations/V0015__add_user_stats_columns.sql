ALTER TABLE t_p67171637_yug_transfer_prize_l.users 
  ADD COLUMN IF NOT EXISTS total_entries integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_spent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wins integer NOT NULL DEFAULT 0;