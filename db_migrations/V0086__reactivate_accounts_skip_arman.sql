UPDATE t_p67171637_yug_transfer_prize_l.tg_user_accounts
SET is_active = TRUE, notes = ''
WHERE is_banned = FALSE;

UPDATE t_p67171637_yug_transfer_prize_l.invite_targets
SET status = 'failed', error = 'PEER_FLOOD на всех аккаунтах — битый кандидат'
WHERE LOWER(username) = 'arman' AND status = 'pending';