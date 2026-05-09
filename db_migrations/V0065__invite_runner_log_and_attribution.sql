CREATE TABLE IF NOT EXISTS invite_run_log (
    id SERIAL PRIMARY KEY,
    account_id INTEGER,
    attempted INTEGER NOT NULL DEFAULT 0,
    added INTEGER NOT NULL DEFAULT 0,
    privacy INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0,
    ban_triggered BOOLEAN NOT NULL DEFAULT FALSE,
    note TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invite_run_log_created_idx ON invite_run_log(created_at DESC);
CREATE INDEX IF NOT EXISTS invite_run_log_account_idx ON invite_run_log(account_id);

ALTER TABLE invite_targets
    ADD COLUMN IF NOT EXISTS invited_by_account_id INTEGER;
