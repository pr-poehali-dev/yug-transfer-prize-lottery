import { Link } from "react-router-dom";
import Icon from "@/components/ui/icon";

export default function Offer() {
  return (
    <div className="min-h-screen mesh-bg">
      <header className="glass border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 md:px-6 flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-3">
            <img
              src="https://cdn.poehali.dev/files/67b1710e-13db-49da-a319-264e54d63c57.png"
              alt="ЮГ ТРАНСФЕР"
              className="h-9 w-auto drop-shadow-[0_0_12px_rgba(255,140,40,0.35)]"
            />
            <span className="font-oswald text-base text-white hidden sm:block">ЮГ ТРАНСФЕР</span>
          </Link>
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors"
          >
            <Icon name="ArrowLeft" size={15} />
            На главную
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <div className="glass border border-white/10 rounded-3xl p-6 md:p-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
              <Icon name="FileText" size={20} className="text-white" />
            </div>
            <h1 className="font-oswald text-3xl md:text-4xl font-bold text-white">
              Публичная оферта
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mb-8">Действует с 20.12.2022</p>

          <div className="space-y-6 text-sm text-white/80 leading-relaxed">
            <section>
              <h2 className="font-oswald text-xl text-white mb-2">1. Предмет оферты</h2>
              <p>
                ИП Хоменко Владимир Владимирович (ИНН 910238307053, ОГРНИП 322911200095120),
                далее — Исполнитель, предлагает любому физическому или юридическому лицу
                (далее — Заказчик) услуги трансфера и перевозки пассажиров на условиях,
                изложенных в настоящей оферте.
              </p>
            </section>

            <section>
              <h2 className="font-oswald text-xl text-white mb-2">2. Акцепт</h2>
              <p>
                Оформление заявки на сайте, в Telegram или по телефону является полным и
                безоговорочным акцептом настоящей оферты. С этого момента Заказчик считается
                принявшим условия в полном объёме.
              </p>
            </section>

            <section>
              <h2 className="font-oswald text-xl text-white mb-2">3. Услуги</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Трансфер из/в аэропорт.</li>
                <li>Междугородние поездки по югу России и Крыму.</li>
                <li>Поездки по тарифам: Срочный, Стандарт, Комфорт, Минивэн, Бизнес.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-oswald text-xl text-white mb-2">4. Стоимость и оплата</h2>
              <p>
                Стоимость услуг согласовывается с диспетчером при оформлении заказа и
                фиксируется до начала поездки. Оплата возможна наличными, переводом или
                банковской картой по согласованию.
              </p>
            </section>

            <section>
              <h2 className="font-oswald text-xl text-white mb-2">5. Права и обязанности</h2>
              <p>
                <strong className="text-white">Исполнитель</strong> обязуется подать автомобиль в
                согласованное время, обеспечить безопасную перевозку и сохранность багажа.
              </p>
              <p>
                <strong className="text-white">Заказчик</strong> обязуется предоставить
                достоверную информацию о маршруте, контактах и количестве пассажиров,
                своевременно оплатить услугу и соблюдать правила поведения в салоне.
              </p>
            </section>

            <section>
              <h2 className="font-oswald text-xl text-white mb-2">6. Отмена и возврат</h2>
              <p>
                Заказчик вправе отменить заказ не позднее, чем за 2 часа до подачи автомобиля
                без штрафных санкций. При более поздней отмене может удерживаться компенсация
                в размере подачи автомобиля.
              </p>
            </section>

            <section>
              <h2 className="font-oswald text-xl text-white mb-2">7. Ответственность</h2>
              <p>
                Стороны несут ответственность в соответствии с законодательством РФ.
                Исполнитель не несёт ответственности за задержки, вызванные обстоятельствами
                непреодолимой силы (погода, дорожная обстановка, действия третьих лиц).
              </p>
            </section>

            <section>
              <h2 className="font-oswald text-xl text-white mb-2">8. Реквизиты</h2>
              <p>
                ИП Хоменко Владимир Владимирович<br />
                ИНН 910238307053 · ОГРНИП 322911200095120<br />
                Дата регистрации: 20.12.2022<br />
                Email:{" "}
                <a href="mailto:help@ug-transfer.com" className="text-cyan-300 hover:text-cyan-200">
                  help@ug-transfer.com
                </a>
                <br />
                Телефон:{" "}
                <a href="tel:+79180295672" className="text-cyan-300 hover:text-cyan-200">
                  +7 (918) 029-56-72
                </a>
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
