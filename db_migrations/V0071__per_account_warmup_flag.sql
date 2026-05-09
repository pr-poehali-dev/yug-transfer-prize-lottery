-- Флаг: нужно ли этому аккаунту прогрев или он уже прогретый
ALTER TABLE tg_user_accounts
    ADD COLUMN IF NOT EXISTS needs_warmup BOOLEAN NOT NULL DEFAULT TRUE;

-- Прогретые (купленные) — выключаем прогрев
UPDATE tg_user_accounts
SET needs_warmup = FALSE
WHERE label IN ('СЗЛТ', 'Phung', 'Susan') OR label LIKE 'Bj%';

-- Свежие (Лиза, Jason) — оставляем с прогревом
UPDATE tg_user_accounts
SET needs_warmup = TRUE
WHERE label IN ('Лиза', 'Jason');
