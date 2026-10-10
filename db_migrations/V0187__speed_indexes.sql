CREATE INDEX IF NOT EXISTS idx_check_lists_phone10 ON t_p67171637_yug_transfer_prize_l.check_lists ((right(regexp_replace(phone, '[^0-9]', '', 'g'), 10))) WHERE phone <> '';
CREATE INDEX IF NOT EXISTS idx_check_lists_shown ON t_p67171637_yug_transfer_prize_l.check_lists (id DESC) WHERE list_type <> 'pending' AND NOT auto_white;
CREATE INDEX IF NOT EXISTS idx_kb_payments_pending ON t_p67171637_yug_transfer_prize_l.kb_payments (tg_user_id, created_at DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_kb_payments_unnotified ON t_p67171637_yug_transfer_prize_l.kb_payments (tg_user_id) WHERE status = 'succeeded' AND NOT notified;
CREATE INDEX IF NOT EXISTS idx_check_list_history_scan ON t_p67171637_yug_transfer_prize_l.check_list_history (item_id) WHERE source = 'scan';