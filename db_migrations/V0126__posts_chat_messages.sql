ALTER TABLE t_p67171637_yug_transfer_prize_l.posts
ADD COLUMN IF NOT EXISTS chat_messages jsonb NOT NULL DEFAULT '{}'::jsonb;