-- Останавливаем старый self-loop excluded-watcher: меняем loop_token, текущий цикл при следующей heartbeat-проверке увидит что токен сменился и завершится
UPDATE excluded_settings
SET loop_token = 'STOPPED_' || extract(epoch from now())::bigint::text,
    loop_heartbeat = NOW()
WHERE id = 1;