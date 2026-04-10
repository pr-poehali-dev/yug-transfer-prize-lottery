CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES t_p67171637_yug_transfer_prize_l.users(id),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);
