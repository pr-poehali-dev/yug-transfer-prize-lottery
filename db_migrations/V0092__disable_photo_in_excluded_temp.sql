-- Временно отключаем фото в рассылке исключённым — аккаунт под медиа-флудом TG.
-- Сохраняем URL фото в служебном поле чтобы потом вернуть.
UPDATE t_p67171637_yug_transfer_prize_l.excluded_settings
SET photo_url = ''
WHERE id = 1;

-- Возвращаем в очередь все застрявшие записи (включая soft_flood и err:Too many requests)
UPDATE t_p67171637_yug_transfer_prize_l.excluded_drivers
SET resend_queued = TRUE,
    resend_status = NULL
WHERE message_sent = FALSE
  AND is_unreachable = FALSE
  AND user_id IS NOT NULL AND user_id <> 0
  AND username IS NOT NULL AND username <> ''
  AND (resend_status IS NULL
       OR resend_status LIKE 'err:Too many requests%'
       OR resend_status LIKE 'soft_flood%'
       OR resend_status LIKE 'flood:%');
