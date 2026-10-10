UPDATE t_p67171637_yug_transfer_prize_l.check_lists c
SET tg_id = COALESCE(c.tg_id, u.tg_id),
    name = CASE WHEN c.name = '' THEN trim(coalesce(u.first_name,'') || ' ' || coalesce(u.last_name,'')) ELSE c.name END,
    phone = CASE WHEN c.phone = '' AND coalesce(u.phone,'') <> '' THEN '+' || regexp_replace(u.phone, '[^0-9]', '', 'g') ELSE c.phone END,
    updated_at = now()
FROM (SELECT DISTINCT ON (lower(username)) lower(username) un, tg_id, first_name, last_name, phone
      FROM t_p67171637_yug_transfer_prize_l.tg_users WHERE coalesce(username,'') <> '' ORDER BY lower(username), updated_at DESC) u
WHERE c.username <> '' AND lower(c.username) = u.un
  AND (c.tg_id IS NULL OR c.name = '' OR c.phone = '')
  AND (c.tg_id IS NOT NULL OR NOT EXISTS (SELECT 1 FROM t_p67171637_yug_transfer_prize_l.check_lists x WHERE x.tg_id = u.tg_id));