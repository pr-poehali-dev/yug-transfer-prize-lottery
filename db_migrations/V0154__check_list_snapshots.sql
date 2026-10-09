CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.check_list_snapshots (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL,
    tg_id BIGINT,
    name TEXT NOT NULL DEFAULT '',
    username TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    photo_url TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT '',
    changed_fields TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_check_list_snapshots_item ON t_p67171637_yug_transfer_prize_l.check_list_snapshots(item_id, created_at DESC);

INSERT INTO t_p67171637_yug_transfer_prize_l.check_list_snapshots (item_id, tg_id, name, username, phone, bio, photo_url, source, created_at)
SELECT id, tg_id, name, username, phone, bio, photo_url, 'created', created_at
FROM t_p67171637_yug_transfer_prize_l.check_lists c
WHERE NOT EXISTS (SELECT 1 FROM t_p67171637_yug_transfer_prize_l.check_list_snapshots s WHERE s.item_id = c.id);