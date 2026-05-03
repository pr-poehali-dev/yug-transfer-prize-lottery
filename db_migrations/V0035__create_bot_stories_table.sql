CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.bot_stories (
  id SERIAL PRIMARY KEY,
  video_url TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  is_used BOOLEAN DEFAULT FALSE,
  last_sent_at TIMESTAMP,
  last_status TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_stories_used ON t_p67171637_yug_transfer_prize_l.bot_stories(is_used, id);