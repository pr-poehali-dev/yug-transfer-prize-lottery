INSERT INTO t_p67171637_yug_transfer_prize_l.check_lists (role, list_type, name, username, phone, note, source)
SELECT 'driver', 'pending', 'ТЕСТ — проверка жалоб', '', '', 'Тестовая карточка для проверки уведомлений о жалобах', 'test'
WHERE NOT EXISTS (SELECT 1 FROM t_p67171637_yug_transfer_prize_l.check_lists WHERE source = 'test' AND name = 'ТЕСТ — проверка жалоб');

INSERT INTO t_p67171637_yug_transfer_prize_l.kb_complaints (item_id, reporter_tg_id, reporter_username, reporter_name, text, incident_date, photos, status, step)
SELECT c.id, 6072837543, 'ug_transfer_online', 'СЗЛТ', 'ТЕСТОВАЯ ЖАЛОБА — проверка уведомлений. Нажмите «Не обоснована», чтобы удалить.', CURRENT_DATE,
       'https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/cc06515e-5e65-4cde-b02f-d24b1889abb4.jpg', 'new', 'done'
FROM t_p67171637_yug_transfer_prize_l.check_lists c
WHERE c.source = 'test' AND c.name = 'ТЕСТ — проверка жалоб'
  AND NOT EXISTS (SELECT 1 FROM t_p67171637_yug_transfer_prize_l.kb_complaints k WHERE k.item_id = c.id AND k.status = 'new');