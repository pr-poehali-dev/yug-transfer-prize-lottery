CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.notifications (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'info',
  sent_at TIMESTAMP DEFAULT now(),
  sent_by VARCHAR(100) DEFAULT 'admin',
  recipients_count INTEGER DEFAULT 0
);
