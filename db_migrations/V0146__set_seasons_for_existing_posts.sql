-- Зима: лыжи, горнолыжные курорты, новогоднее, снег
UPDATE t_p67171637_yug_transfer_prize_l.bot_daily_posts SET season = 'winter'
WHERE id IN (75, 40);

-- Лето: море, пляж, отпуск, жара
UPDATE t_p67171637_yug_transfer_prize_l.bot_daily_posts SET season = 'summer'
WHERE id IN (31, 85, 23, 12, 17, 90, 96);

-- Осень
UPDATE t_p67171637_yug_transfer_prize_l.bot_daily_posts SET season = 'autumn'
WHERE id IN (27);

-- Весна
UPDATE t_p67171637_yug_transfer_prize_l.bot_daily_posts SET season = 'spring'
WHERE id IN (41);