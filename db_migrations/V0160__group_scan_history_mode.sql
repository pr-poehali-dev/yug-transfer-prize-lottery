ALTER TABLE t_p67171637_yug_transfer_prize_l.group_scan_jobs ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'members';
ALTER TABLE t_p67171637_yug_transfer_prize_l.group_scan_jobs ADD COLUMN IF NOT EXISTS last_msg_id BIGINT NOT NULL DEFAULT 0;
ALTER TABLE t_p67171637_yug_transfer_prize_l.group_scan_jobs ADD COLUMN IF NOT EXISTS messages INTEGER NOT NULL DEFAULT 0;
UPDATE t_p67171637_yug_transfer_prize_l.group_scan_jobs SET mode='history', status='running', q_index=0, q_offset=0 WHERE id=1;