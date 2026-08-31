INSERT INTO t_p67171637_yug_transfer_prize_l.app_settings (key, value, updated_at)
VALUES ('invite_target_group', 'https://t.me/moy_transfer', NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();