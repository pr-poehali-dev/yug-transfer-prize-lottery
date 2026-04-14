CREATE TABLE IF NOT EXISTS t_p67171637_yug_transfer_prize_l.bot_daily_posts (
    id SERIAL PRIMARY KEY,
    photo_url TEXT NOT NULL,
    greeting TEXT NOT NULL,
    description TEXT NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    scheduled_date DATE,
    created_at TIMESTAMP DEFAULT now()
);

INSERT INTO t_p67171637_yug_transfer_prize_l.bot_daily_posts (photo_url, greeting, description) VALUES
('https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/d119b7ec-356e-4888-9b28-0660cb78b9ac.jpg', '🚕 Планируете поездку? Мы всегда на связи!', 'Комфортные автомобили, опытные водители, фиксированные цены.'),
('https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/96527428-6821-4e81-99d0-282c2f72809c.jpg', '🚕 Нужно такси? ЮГ ТРАНСФЕР к вашим услугам!', 'Работаем 24/7. Подача от 10 минут в любую точку.'),
('https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/864ce8e0-73e8-446d-9bfe-e3831f917277.jpg', '🚕 Комфортная поездка начинается с одного звонка!', 'Индивидуальный подход к каждому клиенту. Детские кресла по запросу.'),
('https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/1ffc951f-8636-478c-919d-1c374d81a4d4.jpg', '🚕 Куда едем? ЮГ ТРАНСФЕР доставит быстро и с комфортом!', 'Без скрытых доплат. Цена фиксируется при заказе.'),
('https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/28e1f3d4-901c-4fb4-83f2-3de2e23dca47.jpg', '🚕 Трансфер по югу России — легко и удобно!', 'Поездки по всему югу России: море, горы, города.'),
('https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/d4fafd47-2d89-4b23-aa68-277d0f0ec7b5.jpg', '🚕 Надёжный водитель уже ждёт вашего заказа!', 'Чистые авто, вежливые водители, точно в срок.'),
('https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/46e01dc0-a533-49f8-afd8-5b1a8be8a8b9.jpg', '🚕 Путешествуйте с комфортом — выбирайте ЮГ ТРАНСФЕР!', 'Групповые поездки, трансферы, экскурсии — всё для вас.'),
('https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/7b958545-99d0-4a19-b3be-c014a60e6241.jpg', '🚕 Ваш персональный трансфер на юге России!', 'Встреча с табличкой в аэропорту, помощь с багажом.'),
('https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/35cde701-cb7c-4c03-a4e8-a1fe7f80f958.jpg', '🚕 Аэропорт, вокзал, отель — довезём куда угодно!', 'Ваш комфорт — наш приоритет. Кондиционер, Wi-Fi, вода.'),
('https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/39e30d20-b079-452f-803b-a01760cfab4d.jpg', '🚕 Заказывайте такси заранее — будьте уверены в поездке!', 'Бронируйте заранее — гарантируем подачу вовремя.'),
('https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/c9340acf-5478-48d2-a71a-dd2376d031a2.jpg', '🚕 ЮГ ТРАНСФЕР — ваш надёжный партнёр в дороге!', 'Фиксированная цена — без доплат и сюрпризов.'),
('https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/9c10bed9-61a6-44aa-8864-62214d861bac.jpg', '🚕 Едете на море? Закажите трансфер прямо сейчас!', 'Авто на 1–7 пассажиров: Camry, Solaris, Vito.'),
('https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/cfa2de77-2448-4331-9f62-e9c2ae11b310.jpg', '🚕 Поездка с ЮГ ТРАНСФЕР — всегда приятное путешествие!', 'Детские кресла бесплатно. Безопасность превыше всего.'),
('https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/5d68e32e-d8a8-4a91-ba15-b3ccc99cd27b.jpg', '🚕 Встретим в аэропорту, довезём до двери!', 'Бесплатная отмена за 2 часа. Без рисков.'),
('https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/be45fd65-8028-4496-affa-875fdd744f3a.jpg', '🚕 Быстро, безопасно, по лучшей цене — это ЮГ ТРАНСФЕР!', 'Работаем даже ночью и в праздники. Всегда на связи.');