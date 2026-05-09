-- Дата старта прогрева (общая для всего пула)
INSERT INTO app_settings (key, value) VALUES ('warmup_start_date', '')
ON CONFLICT (key) DO NOTHING;

-- Включён ли авторежим прогрева
INSERT INTO app_settings (key, value) VALUES ('warmup_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- Когда последний раз cron делал инвайты с каждого аккаунта (для лимита 1/сутки)
ALTER TABLE tg_user_accounts
    ADD COLUMN IF NOT EXISTS warmup_last_invite_date DATE;
