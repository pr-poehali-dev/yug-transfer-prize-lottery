import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DriverDemo = () => {
  return (
    <div className="h-screen overflow-hidden bg-zinc-950 text-white flex flex-col">
      <header className="px-4 pt-3 flex-shrink-0">
        <div className="max-w-[1400px] mx-auto bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-full px-5 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center font-bold text-xs">
              ЮГ
            </div>
            <span className="font-bold tracking-wider text-xs hidden sm:block">
              ЮГ-ТРАНСФЕР
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs">
            <a className="text-orange-400 border-b-2 border-orange-400 pb-0.5" href="#">
              Главная
            </a>
            <a className="flex items-center gap-1 hover:text-orange-400 transition" href="#">
              Клиенту <Icon name="ChevronDown" size={12} />
            </a>
            <a className="flex items-center gap-1 hover:text-orange-400 transition" href="#">
              Водителю <Icon name="ChevronDown" size={12} />
            </a>
            <a className="hover:text-orange-400 transition" href="#">
              Контакты
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden md:block text-[10px] font-semibold tracking-wider">
              ВЛАДИМИР ХОМЕНКО
            </span>
            <div className="w-8 h-8 rounded-full bg-zinc-700 border-2 border-orange-400 overflow-hidden">
              <div className="w-full h-full bg-gradient-to-br from-zinc-600 to-zinc-800" />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 px-4 py-3">
        <div className="max-w-[1400px] mx-auto h-full grid lg:grid-cols-[400px_1fr] gap-4">
          <aside className="bg-zinc-900/95 backdrop-blur border border-zinc-800 rounded-2xl p-4 shadow-2xl overflow-y-auto">
            <div className="mb-3">
              <h1 className="text-lg font-bold leading-tight">Закажите трансфер</h1>
              <p className="text-[11px] text-zinc-400">
                Перезвоним в течение 5 минут
              </p>
            </div>

            <div className="space-y-2">
              <div className="bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 focus-within:border-orange-400 transition">
                <Label className="text-[10px] text-zinc-400 block leading-tight">Откуда?</Label>
                <Input
                  defaultValue="Ялта, ул. Кирова, 12"
                  className="bg-transparent border-0 h-5 p-0 text-white text-xs focus-visible:ring-0"
                />
              </div>

              <div className="bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 focus-within:border-orange-400 transition">
                <Label className="text-[10px] text-zinc-400 block leading-tight">Куда?</Label>
                <Input
                  placeholder="Введите адрес"
                  className="bg-transparent border-0 h-5 p-0 text-white text-xs focus-visible:ring-0 placeholder:text-zinc-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 focus-within:border-orange-400 transition">
                  <Label className="text-[10px] text-zinc-400 block leading-tight">Имя</Label>
                  <Input
                    defaultValue="Владимир"
                    className="bg-transparent border-0 h-5 p-0 text-white text-xs focus-visible:ring-0"
                  />
                </div>
                <div className="bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 focus-within:border-orange-400 transition">
                  <Label className="text-[10px] text-zinc-400 block leading-tight">Телефон</Label>
                  <Input
                    defaultValue="+7 (984) 334-87-24"
                    className="bg-transparent border-0 h-5 p-0 text-white text-xs focus-visible:ring-0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 focus-within:border-orange-400 transition">
                  <Label className="text-[10px] text-zinc-400 block leading-tight">Дата</Label>
                  <Input
                    type="date"
                    defaultValue="2026-05-17"
                    className="bg-transparent border-0 h-5 p-0 text-white text-xs focus-visible:ring-0 [color-scheme:dark]"
                  />
                </div>
                <div className="bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 focus-within:border-orange-400 transition">
                  <Label className="text-[10px] text-zinc-400 block leading-tight">Время</Label>
                  <Input
                    type="time"
                    defaultValue="22:46"
                    className="bg-transparent border-0 h-5 p-0 text-white text-xs focus-visible:ring-0 [color-scheme:dark]"
                  />
                </div>
              </div>

              <div>
                <Label className="text-[10px] text-zinc-400 mb-1 block px-0.5">
                  Тариф
                </Label>
                <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                  {[
                    { icon: "Zap", name: "Срочный", price: "2 500 ₽", active: true },
                    { icon: "Car", name: "Стандарт", price: "1 800 ₽" },
                    { icon: "CarFront", name: "Комфорт", price: "2 200 ₽" },
                  ].map((t) => (
                    <button
                      key={t.name}
                      type="button"
                      className={`rounded-lg p-1.5 text-left transition border ${
                        t.active
                          ? "bg-orange-500/15 border-orange-400"
                          : "bg-zinc-950 border-zinc-700 hover:border-zinc-500"
                      }`}
                    >
                      <Icon
                        name={t.icon}
                        size={14}
                        className={t.active ? "text-orange-400 mb-0.5" : "text-zinc-400 mb-0.5"}
                      />
                      <div className="text-[10px] font-semibold leading-tight">{t.name}</div>
                      <div className="text-[9px] text-zinc-500">{t.price}</div>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { icon: "Bus", name: "Минивэн", price: "3 500 ₽" },
                    { icon: "Crown", name: "Бизнес", price: "5 000 ₽" },
                    { icon: "Plus", name: "Доп.", price: "кресло" },
                  ].map((t) => (
                    <button
                      key={t.name}
                      type="button"
                      className="bg-zinc-950 border border-zinc-700 hover:border-zinc-500 rounded-lg p-1.5 text-left transition"
                    >
                      <Icon name={t.icon} size={14} className="text-zinc-400 mb-0.5" />
                      <div className="text-[10px] font-semibold leading-tight">{t.name}</div>
                      <div className="text-[9px] text-zinc-500">{t.price}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1.5 pt-1">
                <button className="w-9 h-9 bg-zinc-950 border border-zinc-700 rounded-lg flex items-center justify-center hover:border-orange-400 transition">
                  <Icon name="Wallet" size={14} className="text-zinc-400" />
                </button>
                <Button className="flex-1 h-9 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg text-xs">
                  <Icon name="Send" size={14} className="mr-1.5" />
                  Заказать трансфер
                </Button>
                <button className="w-9 h-9 bg-zinc-950 border border-zinc-700 rounded-lg flex items-center justify-center hover:border-orange-400 transition">
                  <Icon name="SlidersHorizontal" size={14} className="text-zinc-400" />
                </button>
              </div>

              <p className="text-[9px] text-zinc-500 text-center">
                Нажимая кнопку, вы соглашаетесь с обработкой данных
              </p>
            </div>
          </aside>

          <section className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900">
            <iframe
              title="Карта маршрута"
              src="https://yandex.ru/map-widget/v1/?ll=34.166306%2C44.499104&z=13&l=map"
              className="w-full h-full absolute inset-0"
              loading="lazy"
            />

            <div className="absolute top-3 left-3 bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 text-[11px]">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span>
                Доступно <b>27 водителей</b> рядом
              </span>
            </div>

            <div className="absolute bottom-3 right-3 bg-zinc-900/95 backdrop-blur border border-zinc-800 rounded-xl p-3 max-w-[260px]">
              <div className="text-sm font-bold mb-0.5">+7 (984) 334-87-24</div>
              <div className="text-[10px] text-zinc-400 mb-2">
                Закажите по телефону или в мессенджере
              </div>
              <div className="flex gap-1.5">
                <a className="w-8 h-8 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center transition cursor-pointer">
                  <Icon name="Send" size={13} />
                </a>
                <a className="w-8 h-8 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center transition cursor-pointer">
                  <Icon name="MessageCircle" size={13} />
                </a>
                <a className="w-8 h-8 bg-purple-500 hover:bg-purple-600 rounded-full flex items-center justify-center transition cursor-pointer">
                  <Icon name="Phone" size={13} />
                </a>
              </div>
            </div>

            <div className="absolute bottom-3 left-3 right-[280px] hidden xl:grid grid-cols-4 gap-2">
              {[
                { icon: "Clock", title: "Подача 10 мин" },
                { icon: "MapPin", title: "По всей России" },
                { icon: "Shield", title: "Безопасность" },
                { icon: "Wallet", title: "Фикс. цена" },
              ].map((f) => (
                <div
                  key={f.title}
                  className="bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-lg px-2.5 py-1.5 flex gap-1.5 items-center"
                >
                  <Icon name={f.icon} size={14} className="text-orange-400 flex-shrink-0" />
                  <div className="text-[11px] font-semibold truncate">{f.title}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default DriverDemo;
