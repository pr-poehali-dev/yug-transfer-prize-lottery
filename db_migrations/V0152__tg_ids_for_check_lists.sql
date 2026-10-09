ALTER TABLE t_p67171637_yug_transfer_prize_l.check_lists ADD COLUMN IF NOT EXISTS tg_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_check_lists_tg_id ON t_p67171637_yug_transfer_prize_l.check_lists(tg_id);

CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.tg_users (
    tg_id BIGINT PRIMARY KEY,
    username TEXT NOT NULL DEFAULT '',
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tg_users_username ON t_p67171637_yug_transfer_prize_l.tg_users(lower(username));

INSERT INTO t_p67171637_yug_transfer_prize_l.tg_users (tg_id, username, first_name, last_name, phone, source)
SELECT DISTINCT ON (telegram_id) telegram_id, coalesce(username,''), coalesce(first_name,''), coalesce(last_name,''), coalesce(phone,''), 'users'
FROM t_p67171637_yug_transfer_prize_l.users WHERE telegram_id IS NOT NULL
ORDER BY telegram_id, updated_at DESC NULLS LAST
ON CONFLICT (tg_id) DO NOTHING;

INSERT INTO t_p67171637_yug_transfer_prize_l.tg_users (tg_id, username, first_name, source)
SELECT DISTINCT ON (user_id) user_id, coalesce(username,''), coalesce(first_name,''), 'excluded'
FROM t_p67171637_yug_transfer_prize_l.excluded_drivers WHERE user_id IS NOT NULL
ORDER BY user_id, detected_at DESC NULLS LAST
ON CONFLICT (tg_id) DO NOTHING;

INSERT INTO t_p67171637_yug_transfer_prize_l.tg_users (tg_id, username, first_name, source)
SELECT tg_user_id, coalesce(username,''), coalesce(first_name,''), 'subs'
FROM t_p67171637_yug_transfer_prize_l.driver_subs
ON CONFLICT (tg_id) DO NOTHING;

INSERT INTO t_p67171637_yug_transfer_prize_l.tg_users (tg_id, username, first_name, source)
SELECT DISTINCT ON (chat_id) chat_id, coalesce(username,''), coalesce(first_name,''), 'sait_bot'
FROM t_p67171637_yug_transfer_prize_l.sait_bot_users WHERE chat_id > 0
ORDER BY chat_id, created_at DESC NULLS LAST
ON CONFLICT (tg_id) DO NOTHING;