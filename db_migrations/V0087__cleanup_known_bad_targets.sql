-- Отсеиваем заранее известные «каналы» и «битые кандидаты» чтобы они не съедали попытки
UPDATE t_p67171637_yug_transfer_prize_l.invite_targets
SET status = 'failed'
WHERE status = 'pending' AND error LIKE '%Cannot cast InputPeerChannel%';

-- UserNotMutualContactError тоже выкидываем из очереди — этих не добавить
UPDATE t_p67171637_yug_transfer_prize_l.invite_targets
SET status = 'failed'
WHERE status = 'pending' AND error = 'UserNotMutualContactError';