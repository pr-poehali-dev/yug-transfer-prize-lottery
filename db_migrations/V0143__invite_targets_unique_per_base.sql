DROP INDEX IF EXISTS t_p67171637_yug_transfer_prize_l.invite_targets_username_uq;
DROP INDEX IF EXISTS t_p67171637_yug_transfer_prize_l.invite_targets_phone_uq;

CREATE UNIQUE INDEX IF NOT EXISTS invite_targets_base_username_uq
  ON t_p67171637_yug_transfer_prize_l.invite_targets (base_id, lower(username))
  WHERE username IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS invite_targets_base_phone_uq
  ON t_p67171637_yug_transfer_prize_l.invite_targets (base_id, phone)
  WHERE phone IS NOT NULL;