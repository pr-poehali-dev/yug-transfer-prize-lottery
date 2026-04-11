CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.posts (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    text TEXT NOT NULL,
    photo_url TEXT DEFAULT '',
    button_text TEXT DEFAULT '',
    button_url TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',  -- draft | scheduled | published | failed
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    telegram_message_id BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_status ON t_p67171637_yug_transfer_prize_l.posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_at ON t_p67171637_yug_transfer_prize_l.posts(scheduled_at);
