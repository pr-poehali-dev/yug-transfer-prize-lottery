-- Активируем один аккаунт из пула (все живые, но не активны)
UPDATE t_p67171637_yug_transfer_prize_l.tg_user_accounts
SET is_active = TRUE, notes = ''
WHERE id = (
  SELECT id FROM t_p67171637_yug_transfer_prize_l.tg_user_accounts
  WHERE is_banned = FALSE
  ORDER BY id ASC
  LIMIT 1
);

-- Очистим устаревшую заметку про PEER_FLOOD у всех остальных живых аккаунтов
UPDATE t_p67171637_yug_transfer_prize_l.tg_user_accounts
SET notes = ''
WHERE is_banned = FALSE AND notes LIKE 'PEER_FLOOD%';