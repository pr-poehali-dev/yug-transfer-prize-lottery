CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.payment_log (
    id SERIAL PRIMARY KEY,
    kind VARCHAR(20) NOT NULL,            -- commission | refund | subscription
    tg_user_id BIGINT NOT NULL,
    username TEXT DEFAULT '',
    first_name TEXT DEFAULT '',
    amount_rub NUMERIC(10,2) DEFAULT 0,
    order_id INTEGER,
    payment_id TEXT DEFAULT '',
    note TEXT DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_log_created ON t_p67171637_yug_transfer_prize_l.payment_log (created_at DESC);
