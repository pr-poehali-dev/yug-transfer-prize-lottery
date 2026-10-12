INSERT INTO t_p67171637_yug_transfer_prize_l.check_list_history (item_id, field, old_value, new_value, source)
SELECT id, 'list_type', 'pending', 'white', 'manual' FROM t_p67171637_yug_transfer_prize_l.check_lists WHERE list_type = 'pending';

UPDATE t_p67171637_yug_transfer_prize_l.check_lists
SET list_type = 'white', role = 'driver', updated_at = now()
WHERE list_type = 'pending';