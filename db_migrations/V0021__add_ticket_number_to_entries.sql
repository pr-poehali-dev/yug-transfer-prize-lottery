ALTER TABLE t_p67171637_yug_transfer_prize_l.entries 
  ADD COLUMN ticket_number integer;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY raffle_id ORDER BY id) AS rn
  FROM t_p67171637_yug_transfer_prize_l.entries
)
UPDATE t_p67171637_yug_transfer_prize_l.entries e
SET ticket_number = n.rn
FROM numbered n
WHERE e.id = n.id;