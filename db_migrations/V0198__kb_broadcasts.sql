ALTER TABLE t_p67171637_yug_transfer_prize_l.kb_subscriptions ADD COLUMN IF NOT EXISTS bot_blocked BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.kb_broadcasts (
  id SERIAL PRIMARY KEY,
  text TEXT NOT NULL DEFAULT '',
  photo_url TEXT NOT NULL DEFAULT '',
  button_text TEXT NOT NULL DEFAULT '',
  button_url TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT 'all',
  total INTEGER NOT NULL DEFAULT 0,
  sent INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  cursor_id BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);