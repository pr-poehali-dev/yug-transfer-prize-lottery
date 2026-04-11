CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.raffle_spin (
  id serial PRIMARY KEY,
  raffle_id integer NOT NULL,
  raffle_title text NOT NULL,
  participants jsonb NOT NULL DEFAULT '[]',
  winner_name text,
  winner_photo text,
  status text NOT NULL DEFAULT 'spinning',
  started_at timestamptz NOT NULL DEFAULT now(),
  reveal_at timestamptz NOT NULL DEFAULT (now() + interval '60 seconds')
);