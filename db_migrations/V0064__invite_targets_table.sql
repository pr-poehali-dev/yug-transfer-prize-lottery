CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.invite_targets (
  id SERIAL PRIMARY KEY,
  username TEXT,
  user_id BIGINT,
  phone TEXT,
  first_name TEXT,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  added_at TIMESTAMP,
  error TEXT,
  account_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invite_targets_status_idx ON t_p67171637_yug_transfer_prize_l.invite_targets(status);
CREATE UNIQUE INDEX IF NOT EXISTS invite_targets_username_uq ON t_p67171637_yug_transfer_prize_l.invite_targets(LOWER(username)) WHERE username IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS invite_targets_phone_uq ON t_p67171637_yug_transfer_prize_l.invite_targets(phone) WHERE phone IS NOT NULL;