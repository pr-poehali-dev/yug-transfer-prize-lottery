CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.business_connections (
  id SERIAL PRIMARY KEY,
  connection_id TEXT NOT NULL,
  user_id BIGINT,
  username TEXT,
  is_enabled BOOLEAN DEFAULT TRUE,
  can_reply BOOLEAN DEFAULT FALSE,
  raw JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bc_conn ON t_p67171637_yug_transfer_prize_l.business_connections(connection_id);