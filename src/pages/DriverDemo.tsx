import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DriverDemo = () => {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center font-bold">
              ЮГ
            </div>
            <span className="font-semibold tracking-wide">ЮГ-ТРАНСФЕР</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm">
            <a className="hover:text-orange-400 transition" href="#">Главная</a>
            <a className="hover:text-orange-400 transition" href="#">Клиенту</a>
            <a className="text-orange-400 border-b-2 border-orange-400 pb-1" href="#">Водителю</a>
            <a className="hover:text-orange-400 transition" href="#">Контакты</a>
          </nav>
          <div className="flex items-center gap-2 text-sm">
            <Icon name="Phone" size={16} className="text-orange-400" />
            <span>+7 (984) 334-87-24</span>
          </div>
        </div>
      </header>

      <section className="border-b border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="flex items-center gap-2 text-sm text-zinc-400 mb-4">
            <Icon name="Home" size={14} />
            <span>/</span>
            <span className="text-white">Водителю</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-3">
            Стань водителем <span className="text-orange-400">Юг-Трансфер</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl">
            Получай заказы на междугородние поездки. Свободный график, прозрачные выплаты, поддержка 24/7.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-4 gap-4">
          {[
            { icon: "Wallet", title: "от 80 000 ₽", text: "средний доход в месяц" },
            { icon: "Clock", title: "Свободный график", text: "работай когда удобно" },
            { icon: "Route", title: "1500+ заказов", text: "ежемесячно по югу России" },
            { icon: "HeadphonesIcon", title: "Поддержка 24/7", text: "решаем вопросы быстро" },
          ].map((item) => (
            <div key={item.title} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-orange-400/50 transition">
              <Icon name={item.icon} size={28} className="text-orange-400 mb-3" />
              <div className="font-bold text-lg">{item.title}</div>
              <div className="text-sm text-zinc-400 mt-1">{item.text}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-16">
        <div className="grid md:grid-cols-5 gap-6">
          <div className="md:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8">
            <h2 className="text-2xl font-bold mb-2">Анкета водителя</h2>
            <p className="text-sm text-zinc-400 mb-6">
              Заполни форму — перезвоним в течение 30 минут.
            </p>

            <div className="space-y-4">
              <div>
                <Label className="text-zinc-300 text-sm mb-1.5 block">Ваше имя</Label>
                <Input
                  placeholder="Иван Иванов"
                  className="bg-zinc-950 border-zinc-700 text-white h-11"
                />
              </div>

              <div>
                <Label className="text-zinc-300 text-sm mb-1.5 block">Телефон</Label>
                <Input
                  placeholder="+7 (___) ___-__-__"
                  className="bg-zinc-950 border-zinc-700 text-white h-11"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-zinc-300 text-sm mb-1.5 block">Город</Label>
                  <Input
                    placeholder="Симферополь"
                    className="bg-zinc-950 border-zinc-700 text-white h-11"
                  />
                </div>
                <div>
                  <Label className="text-zinc-300 text-sm mb-1.5 block">Стаж, лет</Label>
                  <Input
                    placeholder="5"
                    className="bg-zinc-950 border-zinc-700 text-white h-11"
                  />
                </div>
              </div>

              <div>
                <Label className="text-zinc-300 text-sm mb-1.5 block">Класс авто</Label>
                <div className="grid grid-cols-2 gap-2">
                  {["Стандарт", "Комфорт", "Минивэн", "Бизнес"].map((cls) => (
                    <button
                      key={cls}
                      type="button"
                      className="border border-zinc-700 hover:border-orange-400 hover:text-orange-400 rounded-lg py-2.5 text-sm transition"
                    >
                      {cls}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-zinc-300 text-sm mb-1.5 block">Комментарий</Label>
                <textarea
                  rows={3}
                  placeholder="Марка, год авто, опыт работы..."
                  className="w-full bg-zinc-950 border border-zinc-700 text-white rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:border-orange-400"
                />
              </div>

              <Button className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-bold text-base">
                <Icon name="Send" size={18} className="mr-2" />
                Отправить анкету
              </Button>

              <p className="text-xs text-zinc-500 text-center">
                Нажимая кнопку, вы соглашаетесь с обработкой персональных данных
              </p>
            </div>
          </div>

          <div className="md:col-span-3 space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8">
              <h3 className="text-xl font-bold mb-5 flex items-center gap-2">
                <Icon name="ListChecks" size={22} className="text-orange-400" />
                Требования к водителю
              </h3>
              <div className="grid md:grid-cols-2 gap-3">
                {[
                  "Водительский стаж от 3 лет",
                  "Категория B",
                  "Авто не старше 2015 года",
                  "Кондиционер в салоне",
                  "Опрятный внешний вид",
                  "Гражданство РФ",
                  "Отсутствие судимостей",
                  "Готовность к межгороду",
                ].map((req) => (
                  <div key={req} className="flex items-start gap-2 text-sm text-zinc-300">
                    <Icon name="Check" size={18} className="text-orange-400 flex-shrink-0 mt-0.5" />
                    <span>{req}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8">
              <h3 className="text-xl font-bold mb-5 flex items-center gap-2">
                <Icon name="Sparkles" size={22} className="text-orange-400" />
                Что ты получаешь
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { icon: "Banknote", title: "Выплаты ежедневно", text: "На карту любого банка" },
                  { icon: "Map", title: "Стабильный поток заказов", text: "Крым, Краснодар, Ростов" },
                  { icon: "Smartphone", title: "Удобное приложение", text: "Все заказы в одном месте" },
                  { icon: "Shield", title: "Юридическая защита", text: "Помогаем при спорных ситуациях" },
                ].map((b) => (
                  <div key={b.title} className="flex gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                      <Icon name={b.icon} size={20} className="text-orange-400" />
                    </div>
                    <div>
                      <div className="font-semibold">{b.title}</div>
                      <div className="text-sm text-zinc-400 mt-0.5">{b.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-400/30 rounded-2xl p-6 md:p-8">
              <div className="flex items-start gap-4">
                <Icon name="MessageCircle" size={28} className="text-orange-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-xl font-bold mb-2">Остались вопросы?</h3>
                  <p className="text-zinc-300 mb-4">Напиши нам в любой удобный мессенджер — отвечаем за 5 минут</p>
                  <div className="flex flex-wrap gap-3">
                    <a className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-lg transition text-sm">
                      <Icon name="Send" size={16} /> Telegram
                    </a>
                    <a className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-lg transition text-sm">
                      <Icon name="MessageSquare" size={16} /> WhatsApp
                    </a>
                    <a className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-lg transition text-sm">
                      <Icon name="Phone" size={16} /> Позвонить
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-800 py-6 text-center text-sm text-zinc-500">
        © 2026 Юг-Трансфер. Демо-страница вёрстки.
      </footer>
    </div>
  );
};

export default DriverDemo;
