-- Снимаем с очереди повторной отправки тех, до кого Telethon не может достучаться
-- (нет access_hash в кэше + нет @username). Это водители, которые вышли из @UG_DRIVER.
UPDATE excluded_drivers
SET resend_queued = FALSE,
    resend_status = 'unreachable: вышел из группы, нет @username',
    resend_at = NOW()
WHERE resend_queued = TRUE
  AND resend_status LIKE '%Could not find the input entity%';
