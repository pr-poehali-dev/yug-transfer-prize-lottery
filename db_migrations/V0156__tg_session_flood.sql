CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.tg_session_flood (
    session_hash TEXT PRIMARY KEY,
    until_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_check_lists_username_lower ON t_p67171637_yug_transfer_prize_l.check_lists (lower(username));