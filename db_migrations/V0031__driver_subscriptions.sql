CREATE TABLE IF NOT EXISTS driver_subscriptions (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL UNIQUE,
  username VARCHAR(255),
  first_name VARCHAR(255),
  plan VARCHAR(20) NOT NULL,
  amount_rub INTEGER NOT NULL,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  payment_id VARCHAR(255),
  reminder_3d_sent BOOLEAN DEFAULT FALSE,
  expired_notify_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_sub_status ON driver_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_driver_sub_expires ON driver_subscriptions(expires_at);
CREATE INDEX IF NOT EXISTS idx_driver_sub_telegram ON driver_subscriptions(telegram_id);

CREATE TABLE IF NOT EXISTS driver_subscription_payments (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL,
  plan VARCHAR(20) NOT NULL,
  amount_rub INTEGER NOT NULL,
  payment_id VARCHAR(255),
  status VARCHAR(20) NOT NULL,
  raw_payload TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_driver_pay_tg ON driver_subscription_payments(telegram_id);