CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.tg_user_session2 (
  id INTEGER PRIMARY KEY DEFAULT 1,
  phone TEXT,
  phone_code_hash TEXT,
  session_string TEXT,
  logged_in BOOLEAN DEFAULT FALSE,
  user_info JSONB,
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT single_row2 CHECK (id = 1)
);

INSERT INTO t_p67171637_yug_transfer_prize_l.tg_user_session2 (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.excluded_drivers (
  id SERIAL PRIMARY KEY,
  user_id BIGINT,
  username TEXT,
  first_name TEXT,
  detected_at TIMESTAMP DEFAULT NOW(),
  message_sent BOOLEAN DEFAULT FALSE,
  message_sent_at TIMESTAMP,
  send_status TEXT,
  source_msg_id BIGINT
);

CREATE INDEX IF NOT EXISTS idx_excluded_user ON t_p67171637_yug_transfer_prize_l.excluded_drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_excluded_unsent ON t_p67171637_yug_transfer_prize_l.excluded_drivers(message_sent);

CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.excluded_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  enabled BOOLEAN DEFAULT FALSE,
  message_template TEXT NOT NULL DEFAULT '🔥🔥 Уважаемый {name}! 🔥🔥

«Трансфер — вся Россия» - это закрытая группа, и для возможности отправлять сообщение нужно оплатить подписку.

🔥 Специально для вас — акция:
Всего 600 рублей на целый год!

📲 Не упустите шанс быть первым — оплатите подписку прямо сейчас через 👉 @VsyaRussiabot',
  last_checked_msg_id BIGINT DEFAULT 0,
  last_run_at TIMESTAMP,
  CONSTRAINT excluded_single CHECK (id = 1)
);

INSERT INTO t_p67171637_yug_transfer_prize_l.excluded_settings (id) VALUES (1) ON CONFLICT DO NOTHING;