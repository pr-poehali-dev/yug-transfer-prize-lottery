CREATE TABLE IF NOT EXISTS ug_driver_members (
  id SERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE NOT NULL,
  username VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  is_bot BOOLEAN DEFAULT FALSE,
  is_premium BOOLEAN DEFAULT FALSE,
  phone VARCHAR(64),
  status VARCHAR(32) DEFAULT 'member',
  joined_at TIMESTAMP,
  last_seen_at TIMESTAMP DEFAULT NOW(),
  first_parsed_at TIMESTAMP DEFAULT NOW(),
  last_parsed_at TIMESTAMP DEFAULT NOW(),
  raw JSONB
);

CREATE INDEX IF NOT EXISTS idx_ug_driver_members_username ON ug_driver_members(username);
CREATE INDEX IF NOT EXISTS idx_ug_driver_members_status ON ug_driver_members(status);
CREATE INDEX IF NOT EXISTS idx_ug_driver_members_last_parsed ON ug_driver_members(last_parsed_at);

CREATE TABLE IF NOT EXISTS ug_driver_parse_runs (
  id SERIAL PRIMARY KEY,
  started_at TIMESTAMP DEFAULT NOW(),
  finished_at TIMESTAMP,
  status VARCHAR(32) DEFAULT 'running',
  total_fetched INTEGER DEFAULT 0,
  new_members INTEGER DEFAULT 0,
  updated_members INTEGER DEFAULT 0,
  error TEXT
);
