-- Возвращаем в очередь повторной отправки всех застрявших исключённых
-- (флуд-ошибки на медиа, не unreachable, ещё не отправлены)
UPDATE t_p67171637_yug_transfer_prize_l.excluded_drivers
SET resend_queued = TRUE,
    resend_status = NULL
WHERE message_sent = FALSE
  AND is_unreachable = FALSE
  AND user_id IS NOT NULL AND user_id <> 0
  AND (send_status LIKE 'err:%' OR send_status LIKE 'flood:%');
