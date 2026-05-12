-- Reset daily counters to REAL successful invites only
UPDATE tg_user_accounts a
SET daily_invites_used = COALESCE(sub.real_added, 0)
FROM (
  SELECT acc.id,
         COUNT(t.id) FILTER (
           WHERE t.status = 'added'
             AND t.added_at::date = CURRENT_DATE
             AND COALESCE(t.error, '') NOT LIKE 'silent%'
             AND COALESCE(t.error, '') NOT LIKE 'already%'
         ) AS real_added
  FROM tg_user_accounts acc
  LEFT JOIN invite_targets t ON t.invited_by_account_id = acc.id
  GROUP BY acc.id
) sub
WHERE a.id = sub.id;
