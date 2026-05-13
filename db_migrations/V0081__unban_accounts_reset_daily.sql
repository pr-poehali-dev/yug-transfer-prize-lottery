UPDATE tg_user_accounts
SET is_banned = FALSE,
    daily_invites_used = 0,
    daily_reset_date = CURRENT_DATE;
