-- Очередь получателей рассылки в личку (засевается из invite_targets)
CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.dm_targets (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    assigned_account_id INTEGER,
    status TEXT NOT NULL DEFAULT 'pending', -- pending | in_progress | sent | privacy | failed
    error TEXT DEFAULT '',
    sent_at TIMESTAMP,
    sent_by_account_id INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dm_targets_status
    ON t_p67171637_yug_transfer_prize_l.dm_targets (status);
CREATE INDEX IF NOT EXISTS idx_dm_targets_assigned
    ON t_p67171637_yug_transfer_prize_l.dm_targets (assigned_account_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dm_targets_username
    ON t_p67171637_yug_transfer_prize_l.dm_targets (lower(username));

-- Общий текст + фото рассылки (одна строка)
CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.dm_message (
    id INTEGER PRIMARY KEY DEFAULT 1,
    text TEXT NOT NULL DEFAULT '',
    photo_url TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT dm_message_one_row CHECK (id = 1)
);

INSERT INTO t_p67171637_yug_transfer_prize_l.dm_message (id, text, photo_url)
VALUES (1, '', '')
ON CONFLICT (id) DO NOTHING;