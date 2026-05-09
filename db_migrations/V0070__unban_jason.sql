UPDATE tg_user_accounts
SET is_banned = FALSE,
    notes = 'Бан снят вручную: PEER_FLOOD был из-за мусорных данных в очереди'
WHERE label = 'Jason' AND is_banned = TRUE;
