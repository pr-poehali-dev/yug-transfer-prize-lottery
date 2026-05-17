-- Возвращаем в очередь записи которые упали на "Too many requests" в первом провальном прогоне.
-- Не трогаем unreachable и уже отправленные.
UPDATE t_p67171637_yug_transfer_prize_l.excluded_drivers
SET resend_queued = TRUE,
    resend_status = NULL
WHERE message_sent = FALSE
  AND is_unreachable = FALSE
  AND user_id IS NOT NULL AND user_id <> 0
  AND username IS NOT NULL AND username <> ''
  AND resend_queued = FALSE
  AND (resend_status LIKE 'err:Too many requests%' OR resend_status LIKE 'soft_flood%');
