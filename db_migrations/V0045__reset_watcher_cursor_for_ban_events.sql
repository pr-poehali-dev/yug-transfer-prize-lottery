-- Сброс курсора чтобы пересканировать события за последние сутки и поймать
-- ban/restrict события (новая логика после фикса)
UPDATE t_p67171637_yug_transfer_prize_l.excluded_settings
SET last_checked_msg_id = 1075000000000
WHERE id = 1;