CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.kb_subscriptions (
    tg_user_id BIGINT PRIMARY KEY,
    username TEXT NOT NULL DEFAULT '',
    first_name TEXT NOT NULL DEFAULT '',
    active_until TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.kb_payments (
    id SERIAL PRIMARY KEY,
    tg_user_id BIGINT,
    username TEXT NOT NULL DEFAULT '',
    first_name TEXT NOT NULL DEFAULT '',
    amount_rub NUMERIC NOT NULL DEFAULT 0,
    days INTEGER NOT NULL DEFAULT 0,
    payment_id TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'succeeded',
    note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kb_payments_created ON t_p67171637_yug_transfer_prize_l.kb_payments(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kb_payments_payment_id ON t_p67171637_yug_transfer_prize_l.kb_payments(payment_id) WHERE payment_id <> '';