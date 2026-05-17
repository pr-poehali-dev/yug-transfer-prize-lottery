import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DriverDemo = () => {
  return (
    <div className="h-screen overflow-hidden bg-zinc-950 text-white relative">
      <iframe
        title="Карта маршрута"
        src="https://yandex.ru/map-widget/v1/?ll=34.166306%2C44.499104&z=12&l=map"
        className="absolute inset-0 w-full h-full"
        loading="lazy"
      />

      <style>{`
        @keyframes drive-1 {
          0%   { transform: translate(20vw, 30vh) rotate(45deg); }
          25%  { transform: translate(40vw, 25vh) rotate(80deg); }
          50%  { transform: translate(55vw, 45vh) rotate(135deg); }
          75%  { transform: translate(35vw, 60vh) rotate(225deg); }
          100% { transform: translate(20vw, 30vh) rotate(45deg); }
        }
        @keyframes drive-2 {
          0%   { transform: translate(60vw, 20vh) rotate(180deg); }
          33%  { transform: translate(45vw, 50vh) rotate(220deg); }
          66%  { transform: translate(70vw, 65vh) rotate(330deg); }
          100% { transform: translate(60vw, 20vh) rotate(180deg); }
        }
        @keyframes drive-3 {
          0%   { transform: translate(75vw, 70vh) rotate(270deg); }
          50%  { transform: translate(50vw, 35vh) rotate(90deg); }
          100% { transform: translate(75vw, 70vh) rotate(270deg); }
        }
        @keyframes drive-4 {
          0%   { transform: translate(30vw, 75vh) rotate(0deg); }
          25%  { transform: translate(55vw, 70vh) rotate(60deg); }
          50%  { transform: translate(65vw, 40vh) rotate(170deg); }
          75%  { transform: translate(40vw, 30vh) rotate(280deg); }
          100% { transform: translate(30vw, 75vh) rotate(0deg); }
        }
        @keyframes drive-5 {
          0%   { transform: translate(85vw, 45vh) rotate(160deg); }
          40%  { transform: translate(65vw, 25vh) rotate(70deg); }
          80%  { transform: translate(80vw, 60vh) rotate(250deg); }
          100% { transform: translate(85vw, 45vh) rotate(160deg); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.5); opacity: 0.8; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        .car-marker {
          position: absolute;
          top: 0; left: 0;
          will-change: transform;
        }
      `}</style>

      <div className="absolute inset-0 pointer-events-none z-[5]">
        {[
          { anim: "drive-1", duration: "28s", color: "bg-orange-500" },
          { anim: "drive-2", duration: "35s", color: "bg-green-500" },
          { anim: "drive-3", duration: "22s", color: "bg-blue-500" },
          { anim: "drive-4", duration: "40s", color: "bg-orange-500" },
          { anim: "drive-5", duration: "30s", color: "bg-purple-500" },
        ].map((c, i) => (
          <div
            key={i}
            className="car-marker"
            style={{
              animation: `${c.anim} ${c.duration} linear infinite`,
            }}
          >
            <div className="relative -translate-x-1/2 -translate-y-1/2">
              <div
                className={`absolute inset-0 w-10 h-10 rounded-full ${c.color} opacity-30`}
                style={{ animation: "pulse-ring 2s ease-out infinite" }}
              />
              <div
                className={`relative w-10 h-10 rounded-full ${c.color} border-2 border-white shadow-lg flex items-center justify-center`}
              >
                <Icon name="Car" size={18} className="text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <header className="absolute top-4 left-4 right-4 z-20">
        <div className="max-w-[1600px] mx-auto bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-full px-6 py-3 flex items-center justify-between shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center font-bold text-sm">
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

      <aside className="absolute top-[76px] left-4 bottom-4 z-10 w-[440px] bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-2xl p-4 shadow-2xl flex flex-col">
        <div className="mb-3">
          <h1 className="text-lg font-bold leading-tight">Закажите трансфер</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Перезвоним в течение 5 минут
          </p>
        </div>

        <div className="space-y-2 flex-1 flex flex-col min-h-0">
          <div className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 focus-within:border-orange-400 transition">
            <Label className="text-[10px] text-zinc-400 block leading-tight">Откуда?</Label>
            <Input
              defaultValue="Ялта, ул. Кирова, 12"
              className="bg-transparent border-0 h-5 p-0 text-white text-xs focus-visible:ring-0"
            />
          </div>

          <div className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 focus-within:border-orange-400 transition">
            <Label className="text-[10px] text-zinc-400 block leading-tight">Куда?</Label>
            <Input
              placeholder="Введите адрес"
              className="bg-transparent border-0 h-5 p-0 text-white text-xs focus-visible:ring-0 placeholder:text-zinc-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 focus-within:border-orange-400 transition">
              <Label className="text-[10px] text-zinc-400 block leading-tight">Имя</Label>
              <Input
                defaultValue="Владимир"
                className="bg-transparent border-0 h-5 p-0 text-white text-xs focus-visible:ring-0"
              />
            </div>
            <div className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 focus-within:border-orange-400 transition">
              <Label className="text-[10px] text-zinc-400 block leading-tight">Телефон</Label>
              <Input
                defaultValue="+7 (984) 334-87-24"
                className="bg-transparent border-0 h-5 p-0 text-white text-xs focus-visible:ring-0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 focus-within:border-orange-400 transition">
              <Label className="text-[10px] text-zinc-400 block leading-tight">Дата</Label>
              <Input
                type="date"
                defaultValue="2026-05-17"
                className="bg-transparent border-0 h-5 p-0 text-white text-xs focus-visible:ring-0 [color-scheme:dark]"
              />
            </div>
            <div className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 focus-within:border-orange-400 transition">
              <Label className="text-[10px] text-zinc-400 block leading-tight">Время</Label>
              <Input
                type="time"
                defaultValue="22:46"
                className="bg-transparent border-0 h-5 p-0 text-white text-xs focus-visible:ring-0 [color-scheme:dark]"
              />
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <Label className="text-[10px] text-zinc-400 mb-1.5 block px-0.5">
              Выберите тариф
            </Label>
            <div className="grid grid-cols-3 grid-rows-2 gap-1.5 flex-1 min-h-0">
              {[
                { icon: "Zap", name: "Срочный", price: "от 2 500 ₽", active: true },
                { icon: "Car", name: "Стандарт", price: "от 1 800 ₽" },
                { icon: "CarFront", name: "Комфорт", price: "от 2 200 ₽" },
                { icon: "Bus", name: "Минивэн", price: "от 3 500 ₽" },
                { icon: "Crown", name: "Бизнес", price: "от 5 000 ₽" },
                { icon: "Plus", name: "Доп.", price: "кресло" },
              ].map((t) => (
                <button
                  key={t.name}
                  type="button"
                  className={`rounded-lg p-2 text-left transition border flex flex-col justify-center min-h-0 ${
                    t.active
                      ? "bg-orange-500/15 border-orange-400"
                      : "bg-zinc-950 border-zinc-700 hover:border-zinc-500"
                  }`}
                >
                  <Icon
                    name={t.icon}
                    size={16}
                    className={`mb-1 ${t.active ? "text-orange-400" : "text-zinc-400"}`}
                  />
                  <div className="text-xs font-semibold leading-tight truncate">{t.name}</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5 truncate">{t.price}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            <button className="w-10 h-10 bg-zinc-950 border border-zinc-700 rounded-lg flex items-center justify-center hover:border-orange-400 transition flex-shrink-0">
              <Icon name="Wallet" size={15} className="text-zinc-400" />
            </button>
            <Button className="flex-1 h-10 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg text-sm">
              <Icon name="Send" size={15} className="mr-1.5" />
              Заказать трансфер
            </Button>
            <button className="w-10 h-10 bg-zinc-950 border border-zinc-700 rounded-lg flex items-center justify-center hover:border-orange-400 transition flex-shrink-0">
              <Icon name="SlidersHorizontal" size={15} className="text-zinc-400" />
            </button>
          </div>

          <p className="text-[10px] text-zinc-500 text-center">
            Нажимая кнопку, вы соглашаетесь с обработкой данных
          </p>
        </div>
      </aside>

      <div className="absolute top-[76px] left-[460px] z-10 bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-xl px-3 py-2 flex items-center gap-2 text-xs shadow-lg">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span>
          Доступно <b>27 водителей</b> рядом
        </span>
      </div>

      <div className="absolute bottom-4 right-4 z-10 bg-zinc-900/95 backdrop-blur border border-zinc-800 rounded-2xl p-4 max-w-[290px] shadow-2xl">
        <div className="text-base font-bold mb-1">+7 (984) 334-87-24</div>
        <div className="text-[11px] text-zinc-400 mb-2.5">
          Закажите по телефону или в мессенджере
        </div>
        <div className="flex gap-2">
          <a className="w-9 h-9 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center transition cursor-pointer">
            <Icon name="Send" size={15} />
          </a>
          <a className="w-9 h-9 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center transition cursor-pointer">
            <Icon name="MessageCircle" size={15} />
          </a>
          <a className="w-9 h-9 bg-purple-500 hover:bg-purple-600 rounded-full flex items-center justify-center transition cursor-pointer">
            <Icon name="Phone" size={15} />
          </a>
        </div>
      </div>

      <div className="absolute bottom-4 left-[460px] right-[310px] z-10 hidden xl:grid grid-cols-4 gap-2">
        {[
          { icon: "Clock", title: "Подача 10 мин" },
          { icon: "MapPin", title: "По всей России" },
          { icon: "Shield", title: "Безопасность" },
          { icon: "Wallet", title: "Фикс. цена" },
        ].map((f) => (
          <div
            key={f.title}
            className="bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-xl px-3 py-2 flex gap-2 items-center shadow-lg"
          >
            <Icon name={f.icon} size={16} className="text-orange-400 flex-shrink-0" />
            <div className="text-xs font-semibold truncate">{f.title}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DriverDemo;