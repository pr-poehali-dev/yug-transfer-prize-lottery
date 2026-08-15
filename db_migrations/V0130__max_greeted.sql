CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.max_greeted (
    chat_id BIGINT PRIMARY KEY,
    user_name VARCHAR(200) DEFAULT '',
    message_id VARCHAR(200) DEFAULT '',
    pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);