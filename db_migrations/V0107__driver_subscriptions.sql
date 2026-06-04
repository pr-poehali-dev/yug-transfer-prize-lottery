CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.driver_subs (
  tg_user_id   BIGINT PRIMARY KEY,
  username     TEXT DEFAULT '',
  first_name   TEXT DEFAULT '',
  active_until TIMESTAMP,
  last_payment_id TEXT DEFAULT '',
  updated_at   TIMESTAMP DEFAULT NOW()
);