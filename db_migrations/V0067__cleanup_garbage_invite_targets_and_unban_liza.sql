-- Помечаем мусорные данные (названия колонок CSV) как failed, чтобы не пытались инвайтить
UPDATE invite_targets
SET status='failed',
    error='мусорные данные: попало название колонки CSV'
WHERE LOWER(username) IN ('first_name','last_name','username','email','phone','id','name','user_name','firstname','lastname')
  AND status='pending';

-- Снимаем бан с Лизы — её сбило мусорными данными, не она виновата
UPDATE tg_user_accounts
SET is_banned=FALSE,
    notes='Бан снят: PEER_FLOOD был из-за мусорных данных в очереди'
WHERE label='Лиза' AND is_banned=TRUE;
