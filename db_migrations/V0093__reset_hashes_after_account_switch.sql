-- Пользователь сменил аккаунт-отправитель. Старые access_hash принадлежали другому
-- аккаунту и для нового невалидны (Telegram: "Invalid Peer"). Сбрасываем их для всех
-- кто ещё не получил сообщение — резолв пойдёт по @username с нового аккаунта.
UPDATE t_p67171637_yug_transfer_prize_l.excluded_drivers
SET access_hash = NULL
WHERE message_sent = FALSE
  AND is_unreachable = FALSE
  AND access_hash IS NOT NULL;

-- Временно отключаем фото (аккаунт может тоже поймать медиа-флуд, текстом надёжнее)
UPDATE t_p67171637_yug_transfer_prize_l.excluded_settings
SET photo_url = ''
WHERE id = 1;

-- Возвращаем 48 в очередь
UPDATE t_p67171637_yug_transfer_prize_l.excluded_drivers
SET resend_queued = TRUE,
    resend_status = NULL
WHERE message_sent = FALSE
  AND is_unreachable = FALSE
  AND user_id IS NOT NULL AND user_id <> 0
  AND username IS NOT NULL AND username <> '';
