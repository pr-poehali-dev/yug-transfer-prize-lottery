CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.sait_bot_users (
    id SERIAL PRIMARY KEY,
    chat_id BIGINT NOT NULL UNIQUE,
    first_name VARCHAR(255),
    username VARCHAR(255),
    created_at TIMESTAMP DEFAULT now()
);