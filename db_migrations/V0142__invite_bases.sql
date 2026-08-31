CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.invite_bases (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    note TEXT DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE t_p67171637_yug_transfer_prize_l.invite_targets
    ADD COLUMN IF NOT EXISTS base_id INTEGER;

INSERT INTO t_p67171637_yug_transfer_prize_l.invite_bases (id, name, note)
SELECT 1, 'Парсинг чатов (старая база)', 'Юг-трансфер - парсинг чатов - Уникальные пользователи.csv'
WHERE NOT EXISTS (SELECT 1 FROM t_p67171637_yug_transfer_prize_l.invite_bases WHERE id = 1);

UPDATE t_p67171637_yug_transfer_prize_l.invite_targets SET base_id = 1 WHERE base_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_invite_targets_base ON t_p67171637_yug_transfer_prize_l.invite_targets (base_id, status);

SELECT setval('t_p67171637_yug_transfer_prize_l.invite_bases_id_seq', GREATEST((SELECT MAX(id) FROM t_p67171637_yug_transfer_prize_l.invite_bases), 1));

INSERT INTO t_p67171637_yug_transfer_prize_l.app_settings (key, value, updated_at)
VALUES ('invite_active_base', '1', NOW())
ON CONFLICT (key) DO NOTHING;