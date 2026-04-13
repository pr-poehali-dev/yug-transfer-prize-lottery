ALTER TABLE t_p67171637_yug_transfer_prize_l.raffles 
  ALTER COLUMN end_date TYPE timestamp without time zone 
  USING end_date + interval '23 hours 59 minutes 59 seconds';