UPDATE t_p67171637_yug_transfer_prize_l.kb_subscriptions
SET screen_msgs = right(trim(both ',' from coalesce(screen_msgs, '') || ',' || kb_msg_id::text), 900),
    kb_msg_id = NULL
WHERE kb_msg_id IS NOT NULL AND kb_msg_id IS DISTINCT FROM start_msg_id;