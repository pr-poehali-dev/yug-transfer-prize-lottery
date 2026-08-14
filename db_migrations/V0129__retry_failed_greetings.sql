UPDATE t_p67171637_yug_transfer_prize_l.business_greeted
SET chat_id = -chat_id
WHERE chat_id > 0 AND (message_id = 0 OR pinned = FALSE);