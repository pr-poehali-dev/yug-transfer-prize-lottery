-- Состояние активного запуска (всегда максимум одна запись с id=1)
CREATE TABLE IF NOT EXISTS invite_active_run (
    id INTEGER PRIMARY KEY DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    mode TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    subtitle TEXT NOT NULL DEFAULT '',
    total_planned INTEGER NOT NULL DEFAULT 0,
    progress_done INTEGER NOT NULL DEFAULT 0,
    progress_added INTEGER NOT NULL DEFAULT 0,
    progress_privacy INTEGER NOT NULL DEFAULT 0,
    progress_failed INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ,
    estimated_sec INTEGER NOT NULL DEFAULT 0,
    last_message TEXT NOT NULL DEFAULT '',
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT only_one_row CHECK (id = 1)
);

INSERT INTO invite_active_run (id, is_active) VALUES (1, FALSE)
ON CONFLICT (id) DO NOTHING;
