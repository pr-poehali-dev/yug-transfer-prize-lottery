CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.kb_payments (
    id TEXT PRIMARY KEY,
    tg_user_id BIGINT NOT NULL,
    chat_id BIGINT NOT NULL,
    plan TEXT NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    paid_at TIMESTAMP NULL
);