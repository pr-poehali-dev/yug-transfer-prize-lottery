UPDATE t_p67171637_yug_transfer_prize_l.excluded_drivers
SET resend_queued = TRUE, resend_status = 'queued'
WHERE detected_at >= NOW() - INTERVAL '24 hours';