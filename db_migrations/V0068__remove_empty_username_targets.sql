-- Помечаем как failed все записи где нет username и нет phone (нечего инвайтить)
UPDATE invite_targets
SET status='failed',
    error='пустые данные (нет username и phone)'
WHERE status='pending'
  AND (username IS NULL OR username = '')
  AND (phone IS NULL OR phone = '');
