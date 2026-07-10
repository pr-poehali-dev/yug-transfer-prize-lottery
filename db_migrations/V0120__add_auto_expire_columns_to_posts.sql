ALTER TABLE t_p67171637_yug_transfer_prize_l.posts
    ADD COLUMN IF NOT EXISTS auto_expire_at timestamp with time zone NULL,
    ADD COLUMN IF NOT EXISTS message_ids bigint[] NULL,
    ADD COLUMN IF NOT EXISTS expired_at timestamp with time zone NULL;