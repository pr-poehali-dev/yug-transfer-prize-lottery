-- Возвращаем "unreachable" в очередь — теперь у нас есть access_hash и можем им написать
UPDATE excluded_drivers
SET resend_queued = TRUE,
    resend_status = 'pending: retry with access_hash'
WHERE resend_status LIKE 'unreachable%';
