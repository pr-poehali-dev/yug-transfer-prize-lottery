ALTER TABLE t_p67171637_yug_transfer_prize_l.bot_daily_posts
  ADD COLUMN IF NOT EXISTS last_tg_status TEXT,
  ADD COLUMN IF NOT EXISTS last_vk_status TEXT,
  ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMP;