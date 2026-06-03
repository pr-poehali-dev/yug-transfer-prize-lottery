UPDATE t_p67171637_yug_transfer_prize_l.tg_user_accounts
SET is_banned = false,
    notes = 'Авто-снятие ложного бана: PEER_FLOOD = временный лимит, не бан'
WHERE id = 3 AND is_banned = true;