ALTER TABLE t_p67171637_yug_transfer_prize_l.kb_complaints ADD COLUMN IF NOT EXISTS group_chat TEXT NOT NULL DEFAULT '';
ALTER TABLE t_p67171637_yug_transfer_prize_l.kb_complaints ADD COLUMN IF NOT EXISTS group_msg_id BIGINT;
ALTER TABLE t_p67171637_yug_transfer_prize_l.kb_complaints ADD COLUMN IF NOT EXISTS reporter_notified BOOLEAN NOT NULL DEFAULT FALSE;