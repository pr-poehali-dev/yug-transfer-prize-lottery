ALTER TABLE t_p67171637_yug_transfer_prize_l.users
  ADD COLUMN IF NOT EXISTS balance integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.entries (
  id          serial PRIMARY KEY,
  user_id     integer NOT NULL REFERENCES t_p67171637_yug_transfer_prize_l.users(id),
  raffle_id   integer NOT NULL REFERENCES t_p67171637_yug_transfer_prize_l.raffles(id),
  tickets     integer NOT NULL DEFAULT 1,
  amount      integer NOT NULL,
  created_at  timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.transactions (
  id              serial PRIMARY KEY,
  user_id         integer NOT NULL REFERENCES t_p67171637_yug_transfer_prize_l.users(id),
  type            varchar(20) NOT NULL,
  amount          integer NOT NULL,
  description     text,
  payment_id      varchar(255),
  status          varchar(20) NOT NULL DEFAULT 'pending',
  created_at      timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entries_user_idx ON t_p67171637_yug_transfer_prize_l.entries(user_id);
CREATE INDEX IF NOT EXISTS transactions_user_idx ON t_p67171637_yug_transfer_prize_l.transactions(user_id);
