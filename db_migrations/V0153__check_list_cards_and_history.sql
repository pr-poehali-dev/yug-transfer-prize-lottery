ALTER TABLE t_p67171637_yug_transfer_prize_l.check_lists
    ADD COLUMN IF NOT EXISTS photo_url TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS photo_file_uid TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS removed_at DATE,
    ADD COLUMN IF NOT EXISTS last_scan_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS scan_status TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.check_list_history (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL,
    field TEXT NOT NULL,
    old_value TEXT NOT NULL DEFAULT '',
    new_value TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT '',
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_check_list_history_item ON t_p67171637_yug_transfer_prize_l.check_list_history(item_id, changed_at DESC);