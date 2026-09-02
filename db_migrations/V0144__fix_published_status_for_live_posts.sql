-- Посты, которые реально висят в группах, но помечены черновиком
-- из-за старой ошибки в сохранении — возвращаем им статус "опубликован".
UPDATE t_p67171637_yug_transfer_prize_l.posts
SET status = 'published',
    published_at = COALESCE(published_at, updated_at, created_at),
    updated_at = NOW()
WHERE status = 'draft'
  AND chat_messages IS NOT NULL
  AND chat_messages::text NOT IN ('{}', 'null')
  AND expired_at IS NULL;