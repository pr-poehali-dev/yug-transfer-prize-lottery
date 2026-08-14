CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.business_greeted (
    chat_id BIGINT PRIMARY KEY,
    connection_id TEXT,
    username TEXT,
    first_name TEXT,
    message_id BIGINT,
    pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);