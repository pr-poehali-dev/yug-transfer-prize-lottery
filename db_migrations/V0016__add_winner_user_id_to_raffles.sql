ALTER TABLE t_p67171637_yug_transfer_prize_l.raffles ADD COLUMN IF NOT EXISTS winner_user_id integer NULL;

UPDATE t_p67171637_yug_transfer_prize_l.raffles r
SET winner_user_id = (
    SELECT u.id FROM t_p67171637_yug_transfer_prize_l.raffle_spin rs
    JOIN t_p67171637_yug_transfer_prize_l.users u ON u.first_name = rs.winner_name
    JOIN t_p67171637_yug_transfer_prize_l.entries e ON e.user_id = u.id AND e.raffle_id = r.id
    WHERE rs.raffle_id = r.id
    ORDER BY rs.id DESC LIMIT 1
)
WHERE r.status = 'ended' AND r.winner IS NOT NULL;