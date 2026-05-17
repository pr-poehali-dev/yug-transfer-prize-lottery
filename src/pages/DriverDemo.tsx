import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DriverDemo = () => {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="px-6 pt-5">
        <div className="max-w-[1400px] mx-auto bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-full px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center font-bold text-sm">
              ЮГ
            </div>
            <span className="font-bold tracking-wider text-sm hidden sm:block">
              ЮГ-ТРАНСФЕР
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm">
            <a className="text-orange-400 border-b-2 border-orange-400 pb-1" href="#">
              Главная
            </a>
            <a className="flex items-center gap-1 hover:text-orange-400 transition" href="#">
              Клиенту <Icon name="ChevronDown" size={14} />
            </a>
            <a className="flex items-center gap-1 hover:text-orange-400 transition" href="#">
              Водителю <Icon name="ChevronDown" size={14} />
            </a>
            <a className="hover:text-orange-400 transition" href="#">
              Контакты
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden md:block text-xs font-semibold tracking-wider">
              ВЛАДИМИР ХОМЕНКО
            </span>
            <div className="w-10 h-10 rounded-full bg-zinc-700 border-2 border-orange-400 overflow-hidden">
              <div className="w-full h-full bg-gradient-to-br from-zinc-600 to-zinc-800" />
            </div>
          </div>
        </div>
      </header>

      <main className="px-6 py-6">
        <div className="max-w-[1400px] mx-auto grid lg:grid-cols-[480px_1fr] gap-6">
          <aside className="bg-zinc-900/95 backdrop-blur border border-zinc-800 rounded-3xl p-6 shadow-2xl">
            <div className="mb-5">
              <h1 className="text-2xl font-bold mb-1">Закажите трансфер</h1>
              <p className="text-sm text-zinc-400">
                Перезвоним в течение 5 минут
              </p>
            </div>

            <div className="space-y-3">
              <div className="bg-zinc-950 border border-zinc-700 rounded-xl p-3 focus-within:border-orange-400 transition">
                <Label className="text-xs text-zinc-400 mb-1 block">Откуда?</Label>
                <Input
                  defaultValue="Россия, Республика Крым, Ялта, улица Кирова, 12"
                  className="bg-transparent border-0 h-7 p-0 text-white text-sm focus-visible:ring-0"
                />
              </div>

              <div className="bg-zinc-950 border border-zinc-700 rounded-xl p-3 focus-within:border-orange-400 transition">
                <Label className="text-xs text-zinc-400 mb-1 block">Куда?</Label>
                <Input
                  placeholder="Введите адрес или город"
                  className="bg-transparent border-0 h-7 p-0 text-white text-sm focus-visible:ring-0 placeholder:text-zinc-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-950 border border-zinc-700 rounded-xl p-3 focus-within:border-orange-400 transition">
                  <Label className="text-xs text-zinc-400 mb-1 block">Ваше имя</Label>
                  <Input
                    defaultValue="Владимир Хоменко"
                    className="bg-transparent border-0 h-7 p-0 text-white text-sm focus-visible:ring-0"
                  />
                </div>
                <div className="bg-zinc-950 border border-zinc-700 rounded-xl p-3 focus-within:border-orange-400 transition">
                  <Label className="text-xs text-zinc-400 mb-1 block">Номер телефона</Label>
                  <Input
                    defaultValue="+7 (984) 334-87-24"
                    className="bg-transparent border-0 h-7 p-0 text-white text-sm focus-visible:ring-0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-950 border border-zinc-700 rounded-xl p-3 focus-within:border-orange-400 transition">
                  <Label className="text-xs text-zinc-400 mb-1 block">Дата поездки</Label>
                  <Input
                    type="date"
                    defaultValue="2026-05-17"
                    className="bg-transparent border-0 h-7 p-0 text-white text-sm focus-visible:ring-0 [color-scheme:dark]"
                  />
                </div>
                <div className="bg-zinc-950 border border-zinc-700 rounded-xl p-3 focus-within:border-orange-400 transition">
                  <Label className="text-xs text-zinc-400 mb-1 block">Во сколько?</Label>
                  <Input
                    type="time"
                    defaultValue="22:46"
                    className="bg-transparent border-0 h-7 p-0 text-white text-sm focus-visible:ring-0 [color-scheme:dark]"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-zinc-400 mb-2 block px-1">
                  Выберите тариф
                </Label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {[
                    { icon: "Zap", name: "Срочный", price: "от 2 500 ₽", active: true },
                    { icon: "Car", name: "Стандарт", price: "от 1 800 ₽" },
                    { icon: "CarFront", name: "Комфорт", price: "от 2 200 ₽" },
                  ].map((t) => (
                    <button
                      key={t.name}
                      type="button"
                      className={`rounded-xl p-2.5 text-left transition border ${
                        t.active
                          ? "bg-orange-500/15 border-orange-400"
                          : "bg-zinc-950 border-zinc-700 hover:border-zinc-500"
                      }`}
                    >
                      <Icon
                        name={t.icon}
                        size={20}
                        className={t.active ? "text-orange-400 mb-1" : "text-zinc-400 mb-1"}
                      />
                      <div className="text-xs font-semibold">{t.name}</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">{t.price}</div>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { icon: "Bus", name: "Минивэн", price: "от 3 500 ₽" },
                    { icon: "Crown", name: "Бизнес", price: "от 5 000 ₽" },
                    { icon: "Plus", name: "Доп. услуги", price: "детское кресло" },
                  ].map((t) => (
                    <button
                      key={t.name}
                      type="button"
                      className="bg-zinc-950 border border-zinc-700 hover:border-zinc-500 rounded-xl p-2.5 text-left transition"
                    >
                      <Icon name={t.icon} size={20} className="text-zinc-400 mb-1" />
                      <div className="text-xs font-semibold">{t.name}</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">{t.price}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button className="w-11 h-11 bg-zinc-950 border border-zinc-700 rounded-xl flex items-center justify-center hover:border-orange-400 transition">
                  <Icon name="Wallet" size={18} className="text-zinc-400" />
                </button>
                <Button className="flex-1 h-11 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl">
                  <Icon name="Send" size={16} className="mr-2" />
                  Заказать трансфер
                </Button>
                <button className="w-11 h-11 bg-zinc-950 border border-zinc-700 rounded-xl flex items-center justify-center hover:border-orange-400 transition">
                  <Icon name="SlidersHorizontal" size={18} className="text-zinc-400" />
                </button>
              </div>

              <p className="text-[11px] text-zinc-500 text-center pt-1">
                Нажимая кнопку, вы соглашаетесь с обработкой персональных данных
              </p>
            </div>
          </aside>

          <section className="relative rounded-3xl overflow-hidden border border-zinc-800 min-h-[640px] bg-zinc-900">
            <iframe
              title="Карта маршрута"
              src="https://yandex.ru/map-widget/v1/?ll=34.166306%2C44.499104&z=13&l=map"
              className="w-full h-full absolute inset-0"
              loading="lazy"
            />

            <div className="absolute top-4 left-4 bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-xl px-3 py-2 flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span>Доступно <b>27 водителей</b> рядом</span>
            </div>

            <div className="absolute bottom-4 right-4 bg-zinc-900/95 backdrop-blur border border-zinc-800 rounded-2xl p-4 max-w-xs">
              <div className="text-lg font-bold mb-1">+7 (984) 334-87-24</div>
              <div className="text-xs text-zinc-400 mb-3">
                Закажите трансфер по телефону или в мессенджере
              </div>
              <div className="flex gap-2">
                <a className="w-10 h-10 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center transition cursor-pointer">
                  <Icon name="Send" size={16} />
                </a>
                <a className="w-10 h-10 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center transition cursor-pointer">
                  <Icon name="MessageCircle" size={16} />
                </a>
                <a className="w-10 h-10 bg-purple-500 hover:bg-purple-600 rounded-full flex items-center justify-center transition cursor-pointer">
                  <Icon name="Phone" size={16} />
                </a>
              </div>
            </div>
          </section>
        </div>

        <div className="max-w-[1400px] mx-auto mt-6 grid md:grid-cols-4 gap-4">
          {[
            { icon: "Clock", title: "Подача за 10 мин", text: "По Ялте и пригороду" },
            { icon: "MapPin", title: "Любые направления", text: "Крым, Краснодар, Ростов, Москва" },
            { icon: "Shield", title: "Безопасность", text: "Проверенные водители и авто" },
            { icon: "Wallet", title: "Фикс. цена", text: "Никаких доплат в пути" },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 flex gap-3 items-start hover:border-orange-400/50 transition"
            >
              <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center flex-shrink-0">
                <Icon name={f.icon} size={20} className="text-orange-400" />
              </div>
              <div>
                <div className="font-semibold text-sm">{f.title}</div>
                <div className="text-xs text-zinc-400 mt-0.5">{f.text}</div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-zinc-800 py-6 mt-6 text-center text-xs text-zinc-500">
        © 2026 Юг-Трансфер. Демо-страница вёрстки.
      </footer>
    </div>
  );
};

export default DriverDemo;
