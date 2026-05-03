CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.tg_user_session (
  id INTEGER PRIMARY KEY DEFAULT 1,
  phone TEXT,
  phone_code_hash TEXT,
  session_string TEXT,
  logged_in BOOLEAN DEFAULT FALSE,
  user_info JSONB,
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO t_p67171637_yug_transfer_prize_l.tg_user_session (id) VALUES (1) ON CONFLICT DO NOTHING;