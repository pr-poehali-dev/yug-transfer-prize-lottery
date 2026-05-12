-- Снимаем с очереди тех у кого Telegram возвращает финальную ошибку про отсутствие пользователя
UPDATE excluded_drivers
SET resend_queued = FALSE,
    resend_status = 'account_gone'
WHERE send_status LIKE '%was %ed (caused by SendMessageRequest)%'
  AND resend_queued = TRUE;
