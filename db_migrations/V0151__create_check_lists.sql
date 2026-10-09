CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.check_lists (
    id SERIAL PRIMARY KEY,
    role TEXT NOT NULL,
    list_type TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    username TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_check_lists_role ON t_p67171637_yug_transfer_prize_l.check_lists(role, list_type);