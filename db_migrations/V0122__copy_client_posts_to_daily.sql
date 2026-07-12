-- Переносим 10 клиентских постов из posts в bot_daily_posts (ежедневные посты)
INSERT INTO t_p67171637_yug_transfer_prize_l.bot_daily_posts (photo_url, greeting, description, is_used)
SELECT
  'https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/d119b7ec-356e-4888-9b28-0660cb78b9ac.jpg',
  title,
  text,
  FALSE
FROM t_p67171637_yug_transfer_prize_l.posts
WHERE status = 'draft'
  AND button_url = 'https://moy-transfer.ru'
  AND title IN (
    '✈️ Трансфер в аэропорт без нервов',
    '🛣️ Межгород с комфортом',
    '👶 Едем с детьми? Позаботимся заранее',
    '💰 Честные цены без скрытых доплат',
    '🌙 Ночные и ранние поездки',
    '🏖️ Трансфер к морю и на курорты',
    '💼 Трансфер для бизнеса и командировок',
    '🚐 Большая компания? Есть минивэн!',
    '⭐️ Нам доверяют тысячи пассажиров',
    '📲 Заказать трансфер — проще простого'
  );
