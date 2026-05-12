-- Сбрасываем last_checked_msg_id чтобы пересканить admin-лог целиком
-- (до 100 последних событий с действиями @VsyaRussiabot)
UPDATE excluded_settings SET last_checked_msg_id = 0 WHERE id = 1;
