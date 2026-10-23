UPDATE t_p67171637_yug_transfer_prize_l.check_lists
SET list_type = 'white', role = 'driver', auto_white = TRUE, updated_at = now()
WHERE list_type = 'pending' AND source NOT IN ('запрос в боте', 'запустил бота', '');

INSERT INTO t_p67171637_yug_transfer_prize_l.check_lists (role, list_type, name, username, phone, tg_id, source, auto_white)
SELECT DISTINCT ON (u.tg_id)
  CASE WHEN u.source IN ('lookup', 'excluded') THEN '' ELSE 'driver' END,
  CASE WHEN u.source IN ('lookup', 'excluded') THEN 'pending' ELSE 'white' END,
  trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')),
  coalesce(u.username, ''),
  coalesce(u.phone, ''),
  u.tg_id,
  CASE WHEN u.source = 'excluded' THEN 'исключён из группы' WHEN u.source = 'lookup' THEN 'запрос в боте' ELSE 'общая база сканера' END,
  u.source NOT IN ('lookup', 'excluded')
FROM t_p67171637_yug_transfer_prize_l.tg_users u
WHERE NOT EXISTS (SELECT 1 FROM t_p67171637_yug_transfer_prize_l.check_lists c
                  WHERE c.tg_id = u.tg_id OR (coalesce(u.username, '') <> '' AND lower(c.username) = lower(u.username)))
  AND NOT EXISTS (SELECT 1 FROM t_p67171637_yug_transfer_prize_l.check_bans b WHERE b.tg_id = u.tg_id)
ORDER BY u.tg_id
ON CONFLICT DO NOTHING;