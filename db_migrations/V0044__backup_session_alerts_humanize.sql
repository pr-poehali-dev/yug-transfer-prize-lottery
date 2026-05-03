-- Backup-сессия: вторая Telethon-сессия для резервного аккаунта
CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.tg_user_session3 (
  id INT PRIMARY KEY DEFAULT 1,
  session_string TEXT,
  logged_in BOOLEAN DEFAULT FALSE,
  phone TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);
INSERT INTO t_p67171637_yug_transfer_prize_l.tg_user_session3 (id, logged_in)
  VALUES (1, FALSE) ON CONFLICT DO NOTHING;

-- Лог алертов про FloodWait и другие проблемы
CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.watcher_alerts (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NOW(),
  alert_type TEXT NOT NULL,
  severity TEXT DEFAULT 'warn',
  message TEXT,
  payload JSONB,
  resolved BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_watcher_alerts_created ON t_p67171637_yug_transfer_prize_l.watcher_alerts(created_at DESC);

-- Какая сессия сейчас активна (primary/backup)
ALTER TABLE t_p67171637_yug_transfer_prize_l.excluded_settings
  ADD COLUMN IF NOT EXISTS active_session SMALLINT DEFAULT 2,
  ADD COLUMN IF NOT EXISTS humanize_enabled BOOLEAN DEFAULT TRUE;