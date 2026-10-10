CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.tg_session_usage (
    session_hash text NOT NULL,
    hour_at timestamptz NOT NULL,
    cnt integer NOT NULL DEFAULT 0,
    PRIMARY KEY (session_hash, hour_at)
);
CREATE INDEX IF NOT EXISTS idx_tg_users_phone10 ON t_p67171637_yug_transfer_prize_l.tg_users ((right(regexp_replace(phone, '[^0-9]', '', 'g'), 10))) WHERE coalesce(phone, '') <> '';
CREATE INDEX IF NOT EXISTS idx_tg_users_username_lower ON t_p67171637_yug_transfer_prize_l.tg_users (lower(username)) WHERE coalesce(username, '') <> '';