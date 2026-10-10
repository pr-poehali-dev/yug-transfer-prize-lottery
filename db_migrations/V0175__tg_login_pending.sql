CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.tg_login_pending (
  phone TEXT PRIMARY KEY,
  session_string TEXT NOT NULL,
  phone_code_hash TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT now()
);