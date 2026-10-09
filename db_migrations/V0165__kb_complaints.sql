CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.kb_complaints (
    id SERIAL PRIMARY KEY,
    item_id INTEGER,
    reporter_tg_id BIGINT NOT NULL,
    reporter_username TEXT NOT NULL DEFAULT '',
    reporter_name TEXT NOT NULL DEFAULT '',
    text TEXT NOT NULL DEFAULT '',
    incident_date DATE,
    photos TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    step TEXT NOT NULL DEFAULT 'text',
    admin_note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kb_complaints_status ON t_p67171637_yug_transfer_prize_l.kb_complaints (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_complaints_reporter ON t_p67171637_yug_transfer_prize_l.kb_complaints (reporter_tg_id, status);
CREATE INDEX IF NOT EXISTS idx_kb_complaints_item ON t_p67171637_yug_transfer_prize_l.kb_complaints (item_id);