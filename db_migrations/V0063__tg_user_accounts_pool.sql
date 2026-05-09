CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.tg_user_accounts (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  phone TEXT,
  session_string TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  daily_invites_used INTEGER NOT NULL DEFAULT 0,
  daily_reset_date DATE NOT NULL DEFAULT CURRENT_DATE,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.tg_account_login_sessions (
  id SERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  phone_code_hash TEXT NOT NULL,
  session_string TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);