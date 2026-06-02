-- Записи без username нельзя пригласить — выводим их из очереди в статус 'no_username'
UPDATE invite_targets
SET status = 'no_username', assigned_account_id = NULL
WHERE (username IS NULL OR username = '') AND status = 'pending';

-- Перераздаём оставшиеся валидные pending-кандидаты поровну по незабаненным аккаунтам
UPDATE invite_targets SET assigned_account_id = NULL WHERE status = 'pending';

WITH pend AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn
    FROM invite_targets
    WHERE status = 'pending'
      AND username IS NOT NULL AND username <> ''
),
accs AS (
    SELECT id AS acc_id, ROW_NUMBER() OVER (ORDER BY id) AS rn
    FROM tg_user_accounts
    WHERE is_banned = FALSE
      AND session_string IS NOT NULL AND session_string <> ''
)
UPDATE invite_targets t
SET assigned_account_id = a.acc_id
FROM pend p
JOIN accs a ON a.rn = ((p.rn - 1) % (SELECT MAX(rn) FROM accs)) + 1
WHERE t.id = p.id;
