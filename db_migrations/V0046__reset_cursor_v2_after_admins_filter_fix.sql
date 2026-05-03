-- Откатываем курсор, чтобы новый код с фильтром admins=[bot] перепроверил
-- баны Доченьки и других в 19:08, 19:12, 19:33
UPDATE t_p67171637_yug_transfer_prize_l.excluded_settings
SET last_checked_msg_id = 1075000000000
WHERE id = 1;