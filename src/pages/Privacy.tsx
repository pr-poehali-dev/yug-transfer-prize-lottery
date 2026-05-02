import { Link } from "react-router-dom";
import Icon from "@/components/ui/icon";

export default function Privacy() {
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
              <Icon name="ShieldCheck" size={20} className="text-white" />
            </div>
            <h1 className="font-oswald text-3xl md:text-4xl font-bold text-white">
              Политика конфиденциальности
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mb-8">Дата вступления в силу: 20.12.2022</p>

          <div className="space-y-6 text-sm text-white/80 leading-relaxed">
            <section>
              <h2 className="font-oswald text-xl text-white mb-2">1. Общие положения</h2>
              <p>
                Настоящая Политика конфиденциальности регулирует порядок обработки и защиты
                персональных данных пользователей сайта ug-transfer.online (далее — Сайт),
                принадлежащего ИП Хоменко Владимир Владимирович (ИНН 910238307053,
                ОГРНИП 322911200095120).
              </p>
            </section>

            <section>
              <h2 className="font-oswald text-xl text-white mb-2">2. Какие данные мы собираем</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Имя пользователя.</li>
                <li>Номер телефона.</li>
                <li>Адрес электронной почты (при добровольном указании).</li>
                <li>Маршрут поездки (откуда / куда), дата и время.</li>
                <li>Технические данные: IP-адрес, тип браузера, cookies.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-oswald text-xl text-white mb-2">3. Цели обработки</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Оформление и выполнение заказов на услуги трансфера.</li>
                <li>Связь с пользователем (звонок, мессенджеры, email).</li>
                <li>Информирование об акциях и изменениях в сервисе.</li>
                <li>Улучшение работы сайта и качества обслуживания.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-oswald text-xl text-white mb-2">4. Передача третьим лицам</h2>
              <p>
                Персональные данные не передаются третьим лицам, за исключением водителей-партнёров
                для исполнения заказа и случаев, предусмотренных законодательством РФ.
              </p>
            </section>

            <section>
              <h2 className="font-oswald text-xl text-white mb-2">5. Хранение и защита</h2>
              <p>
                Данные хранятся на защищённых серверах. Срок хранения соответствует целям обработки
                и требованиям закона. Применяются организационные и технические меры защиты от
                несанкционированного доступа.
              </p>
            </section>

            <section>
              <h2 className="font-oswald text-xl text-white mb-2">6. Права пользователя</h2>
              <p>
                Вы вправе запросить уточнение, удаление или блокировку своих данных, отозвать
                согласие на обработку. Запросы направляйте на{" "}
                <a href="mailto:help@ug-transfer.com" className="text-purple-300 hover:text-purple-200">
                  help@ug-transfer.com
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="font-oswald text-xl text-white mb-2">7. Cookies</h2>
              <p>
                Сайт использует cookies для корректной работы, аналитики и улучшения пользовательского
                опыта. Отключить cookies можно в настройках браузера.
              </p>
            </section>

            <section>
              <h2 className="font-oswald text-xl text-white mb-2">8. Контакты</h2>
              <p>
                ИП Хоменко Владимир Владимирович<br />
                ИНН 910238307053 · ОГРНИП 322911200095120<br />
                Email:{" "}
                <a href="mailto:help@ug-transfer.com" className="text-purple-300 hover:text-purple-200">
                  help@ug-transfer.com
                </a>
                <br />
                Телефон:{" "}
                <a href="tel:+79180295672" className="text-purple-300 hover:text-purple-200">
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
