CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.group_scan_jobs (
    id SERIAL PRIMARY KEY,
    chat TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    session_hash TEXT NOT NULL DEFAULT '',
    q_index INTEGER NOT NULL DEFAULT 0,
    q_offset INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'running',
    fetched INTEGER NOT NULL DEFAULT 0,
    added INTEGER NOT NULL DEFAULT 0,
    skipped INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    error TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_check_lists_tg_id ON t_p67171637_yug_transfer_prize_l.check_lists (tg_id) WHERE tg_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_check_lists_username ON t_p67171637_yug_transfer_prize_l.check_lists (lower(username)) WHERE username <> '';
ALTER TABLE t_p67171637_yug_transfer_prize_l.check_lists ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT '';