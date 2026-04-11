ALTER TABLE t_p67171637_yug_transfer_prize_l.raffles
  ADD COLUMN IF NOT EXISTS target_amount integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.jackpot (
  id serial PRIMARY KEY,
  balance integer NOT NULL DEFAULT 0,
  next_draw_at timestamptz NOT NULL DEFAULT (now() + interval '6 months'),
  last_winner text,
  last_draw_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO t_p67171637_yug_transfer_prize_l.jackpot (balance, next_draw_at)
SELECT 0, now() + interval '6 months'
WHERE NOT EXISTS (SELECT 1 FROM t_p67171637_yug_transfer_prize_l.jackpot);