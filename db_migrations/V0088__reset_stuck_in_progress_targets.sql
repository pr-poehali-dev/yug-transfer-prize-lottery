-- Возвращаем в pending все таргеты которые были взяты прошлыми запусками, но не получили финальный статус
UPDATE t_p67171637_yug_transfer_prize_l.invite_targets
SET status = 'pending'
WHERE status = 'in_progress';