ALTER TABLE t_p67171637_yug_transfer_prize_l.bot_daily_posts
    ADD COLUMN IF NOT EXISTS season TEXT NOT NULL DEFAULT 'any';

COMMENT ON COLUMN t_p67171637_yug_transfer_prize_l.bot_daily_posts.season IS
    'any | winter | spring | summer | autumn — когда пост уместен';

CREATE INDEX IF NOT EXISTS idx_bot_daily_posts_season
    ON t_p67171637_yug_transfer_prize_l.bot_daily_posts (season, scheduled_date);