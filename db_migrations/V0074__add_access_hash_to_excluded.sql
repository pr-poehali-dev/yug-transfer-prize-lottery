-- Сохраняем access_hash от Telegram чтобы можно было писать водителям даже после выхода из группы
ALTER TABLE excluded_drivers
ADD COLUMN IF NOT EXISTS access_hash BIGINT;
