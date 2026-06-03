ALTER TABLE t_p67171637_yug_transfer_prize_l.dm_message
    ADD COLUMN IF NOT EXISTS button_text TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS button_url  TEXT NOT NULL DEFAULT '';