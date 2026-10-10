ALTER TABLE t_p67171637_yug_transfer_prize_l.kb_complaints ADD COLUMN IF NOT EXISTS need_repost boolean NOT NULL DEFAULT false;
UPDATE t_p67171637_yug_transfer_prize_l.kb_complaints SET need_repost = true, text = '' WHERE id = 8 AND text = '🚗 Водитель';
UPDATE t_p67171637_yug_transfer_prize_l.kb_complaints SET need_repost = true WHERE id = 8;