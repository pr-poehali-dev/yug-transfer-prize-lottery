CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.check_bans (
  tg_id BIGINT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);