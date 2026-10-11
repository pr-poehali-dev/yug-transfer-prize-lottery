ALTER TABLE t_p67171637_yug_transfer_prize_l.check_lists ADD COLUMN IF NOT EXISTS groups TEXT[] NOT NULL DEFAULT '{}';
UPDATE t_p67171637_yug_transfer_prize_l.check_lists SET groups = ARRAY[source]
WHERE source IN (SELECT DISTINCT title FROM t_p67171637_yug_transfer_prize_l.group_scan_jobs WHERE coalesce(title,'') <> '');