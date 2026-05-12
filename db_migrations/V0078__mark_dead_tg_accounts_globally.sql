-- Добавляем флаг "аккаунт стёрт навсегда" чтобы фильтровать на всех уровнях
ALTER TABLE excluded_drivers
ADD COLUMN IF NOT EXISTS is_unreachable BOOLEAN NOT NULL DEFAULT FALSE;

-- Помечаем всех у кого Telegram уже отвечал что юзер не существует
UPDATE excluded_drivers
SET is_unreachable = TRUE,
    resend_queued = FALSE
WHERE send_status LIKE '%user was %ed%'
   OR send_status LIKE '%user is %ed%'
   OR send_status LIKE '%USER_DEACTIVATED%'
   OR send_status LIKE '%USER_ID_INVALID%'
   OR resend_status LIKE 'account_gone%'
   OR resend_status LIKE '%permanently%';

-- Индекс для быстрой фильтрации
CREATE INDEX IF NOT EXISTS idx_excluded_unreachable ON excluded_drivers(is_unreachable, resend_queued);
