CREATE TABLE IF NOT EXISTS tg_user_session3 (
  id INTEGER PRIMARY KEY DEFAULT 1,
  phone TEXT,
  phone_code_hash TEXT,
  session_string TEXT,
  logged_in BOOLEAN DEFAULT FALSE,
  user_info JSONB,
  updated_at TIMESTAMP DEFAULT NOW()
);
INSERT INTO tg_user_session3 (id, logged_in) VALUES (1, FALSE) ON CONFLICT (id) DO NOTHING;
