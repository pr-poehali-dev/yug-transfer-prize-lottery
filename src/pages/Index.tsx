import { useState, lazy, Suspense } from "react";
import Icon from "@/components/ui/icon";

const ContactsSection = lazy(() =>
  import("@/components/sections/ContactsSection").then((m) => ({ default: m.ContactsSection }))
);

type Section = "home" | "services" | "bot" | "drivers" | "contacts";

const NAV: { id: Section; label: string; icon: string }[] = [
  { id: "home", label: "Главная", icon: "Rocket" },
  { id: "services", label: "Услуги", icon: "Car" },
  { id: "bot", label: "Бот", icon: "Bot" },
  { id: "drivers", label: "Водителям", icon: "Briefcase" },
  { id: "contacts", label: "Контакты", icon: "Phone" },
];

export default function Index() {
  const [active, setActive] = useState<Section>("home");
  const [menuOpen, setMenuOpen] = useState(false);

  const go = (s: Section) => {
    setActive(s);
    setMenuOpen(false);
  };

  return (
    <div className="min-h-screen mesh-bg">
      {/* Header */}
      <header className="glass border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between h-16">
          <button onClick={() => go("home")} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center text-lg shadow-lg animate-pulse-glow">
              🚀
            </div>
            <div className="text-left">
              <span className="font-oswald text-lg font-bold text-white">ЮГ</span>
              <span className="font-oswald text-lg font-bold grad-text"> ТРАНСФЕР</span>
              <p className="text-[10px] text-muted-foreground -mt-1 hidden sm:block">
                космические трансферы юга
              </p>
            </div>
          </button>

          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => go(n.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  active === n.id
                    ? "grad-btn shadow-lg"
                    : "text-muted-foreground hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon name={n.icon} size={16} fallback="Circle" />
                {n.label}
              </button>
            ))}
          </nav>

          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden p-2 rounded-xl border border-white/10 text-white"
          >
            <Icon name={menuOpen ? "X" : "Menu"} size={20} />
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-white/5 px-4 py-3 flex flex-col gap-1">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => go(n.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  active === n.id
                    ? "grad-btn shadow-lg"
                    : "text-muted-foreground hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon name={n.icon} size={17} fallback="Circle" />
                {n.label}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12">
        {active === "home" && <HomeSection onNav={go} />}
        {active === "services" && <ServicesSection />}
        {active === "bot" && <BotSection />}
        {active === "drivers" && <DriversSection />}
        {active === "contacts" && (
          <Suspense fallback={<div className="text-center text-muted-foreground py-20">Загрузка...</div>}>
            <ContactsSection />
          </Suspense>
        )}
      </main>

      <footer className="border-t border-white/5 mt-16">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} ЮГ ТРАНСФЕР · все системы в норме</p>
          <div className="flex items-center gap-4">
            <a href="https://t.me/ug_transfer_online" className="hover:text-white transition-colors">
              Telegram
            </a>
            <a href="tel:+79180295672" className="hover:text-white transition-colors">
              +7 (918) 029-56-72
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function HomeSection({ onNav }: { onNav: (s: Section) => void }) {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl glass border border-white/10 p-8 md:p-14">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-purple-500/20 blur-3xl animate-pulse-glow" />
        <div className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute top-10 right-10 text-6xl animate-float opacity-30 hidden md:block">🛸</div>

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-purple-500/30 text-xs text-purple-300 mb-6">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            На связи 24/7 · приём заказов
          </div>

          <h1 className="font-oswald text-4xl md:text-6xl font-bold leading-tight text-white mb-5">
            Трансферы по югу <br />
            на <span className="grad-text">световой</span> скорости
          </h1>
          <p className="text-muted-foreground text-base md:text-lg mb-8 max-w-2xl">
            Аэропорты, межгород, по Краснодарскому краю и Крыму. Комфортные авто,
            проверенные водители, фиксированная цена. Бронируй за минуту через Telegram.
          </p>

          <div className="flex flex-wrap gap-3">
            <a
              href="https://t.me/ug_transfer_online"
              target="_blank"
              rel="noreferrer"
              className="grad-btn rounded-xl px-6 py-3.5 font-semibold flex items-center gap-2"
            >
              <Icon name="Send" size={18} />
              Заказать в Telegram
            </a>
            <button
              onClick={() => onNav("services")}
              className="glass border border-white/10 hover:border-purple-500/50 rounded-xl px-6 py-3.5 font-semibold text-white transition-all flex items-center gap-2"
            >
              <Icon name="Compass" size={18} />
              Посмотреть услуги
            </button>
          </div>
        </div>
      </section>

      {/* Stats / planets */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: "Rocket", label: "Поездок", value: "12 000+", color: "from-purple-500 to-pink-500" },
          { icon: "Star", label: "Рейтинг", value: "4.9 / 5", color: "from-yellow-400 to-orange-500" },
          { icon: "Users", label: "Водителей", value: "120+", color: "from-cyan-500 to-blue-500" },
          { icon: "Globe", label: "Городов", value: "30+", color: "from-green-500 to-emerald-500" },
        ].map((s, i) => (
          <div
            key={s.label}
            className="card-glow rounded-2xl p-5 text-center opacity-0-init animate-fade-in-up"
            style={{ animationDelay: `${i * 0.08}s`, animationFillMode: "forwards" }}
          >
            <div
              className={`w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center shadow-lg`}
            >
              <Icon name={s.icon} size={20} className="text-white" fallback="Circle" />
            </div>
            <p className="font-oswald text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </section>

      {/* Quick nav cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <NavCard
          icon="Car"
          title="Услуги"
          desc="Трансферы, межгород, аэропорт. Любые направления юга России."
          color="from-purple-600 to-pink-500"
          onClick={() => onNav("services")}
        />
        <NavCard
          icon="Bot"
          title="Telegram-бот"
          desc="Бот @ug_sait_bot — быстрая связь с диспетчером и оформление поездки."
          color="from-cyan-500 to-blue-600"
          onClick={() => onNav("bot")}
        />
        <NavCard
          icon="Briefcase"
          title="Водителям"
          desc="Подключайся к платформе, получай заказы и зарабатывай больше."
          color="from-orange-500 to-red-500"
          onClick={() => onNav("drivers")}
        />
      </section>
    </div>
  );
}

function NavCard({
  icon,
  title,
  desc,
  color,
  onClick,
}: {
  icon: string;
  title: string;
  desc: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="card-glow rounded-2xl p-6 text-left group">
      <div
        className={`w-12 h-12 mb-4 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}
      >
        <Icon name={icon} size={22} className="text-white" fallback="Circle" />
      </div>
      <h3 className="font-oswald text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4">{desc}</p>
      <span className="text-purple-400 text-sm font-medium flex items-center gap-1.5 group-hover:gap-2.5 transition-all">
        Открыть <Icon name="ArrowRight" size={14} />
      </span>
    </button>
  );
}

function ServicesSection() {
  const services = [
    {
      icon: "Plane",
      title: "Аэропорт",
      desc: "Встреча с табличкой, помощь с багажом. Адлер, Краснодар, Симферополь.",
      price: "от 1 500 ₽",
      color: "from-cyan-500 to-blue-600",
    },
    {
      icon: "Map",
      title: "Межгород",
      desc: "Поездки между городами юга. Фиксированная цена, без сюрпризов.",
      price: "от 3 000 ₽",
      color: "from-purple-500 to-pink-500",
    },
    {
      icon: "Building2",
      title: "По городу",
      desc: "Комфортные поездки внутри города. Любые расстояния.",
      price: "от 500 ₽",
      color: "from-orange-500 to-red-500",
    },
    {
      icon: "Mountain",
      title: "Экскурсии",
      desc: "Поездки по достопримечательностям Кубани и Крыма с водителем.",
      price: "от 5 000 ₽",
      color: "from-green-500 to-emerald-500",
    },
    {
      icon: "Briefcase",
      title: "Корпоратив",
      desc: "Регулярные поездки для компаний. Договор, безнал, отчётность.",
      price: "по запросу",
      color: "from-yellow-400 to-orange-500",
    },
    {
      icon: "Users",
      title: "Группы",
      desc: "Минивэны на 6-8 человек. Свадьбы, конференции, командировки.",
      price: "от 4 000 ₽",
      color: "from-pink-500 to-purple-600",
    },
  ];

  return (
    <div>
      <SectionHeader
        title="Наши услуги"
        subtitle="Выбирай направление и оформляй поездку в пару кликов"
        icon="Sparkles"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {services.map((s, i) => (
          <div
            key={s.title}
            className="card-glow rounded-2xl p-6 opacity-0-init animate-fade-in-up"
            style={{ animationDelay: `${i * 0.07}s`, animationFillMode: "forwards" }}
          >
            <div
              className={`w-14 h-14 mb-4 rounded-2xl bg-gradient-to-br ${s.color} flex items-center justify-center shadow-lg`}
            >
              <Icon name={s.icon} size={26} className="text-white" fallback="Circle" />
            </div>
            <h3 className="font-oswald text-2xl font-bold text-white mb-2">{s.title}</h3>
            <p className="text-sm text-muted-foreground mb-4">{s.desc}</p>
            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Цена</span>
              <span className="grad-text font-oswald text-xl font-bold">{s.price}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BotSection() {
  return (
    <div>
      <SectionHeader
        title="Telegram-бот"
        subtitle="Космическая капсула связи с диспетчером"
        icon="Bot"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-glow rounded-2xl p-8 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="relative z-10">
            <div className="w-16 h-16 mb-5 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg animate-pulse-glow">
              <Icon name="Bot" size={32} className="text-white" />
            </div>
            <h3 className="font-oswald text-3xl font-bold text-white mb-3">@ug_sait_bot</h3>
            <p className="text-muted-foreground mb-6">
              Открой бота — и получай ежедневные посты с актуальными контактами,
              новостями и спецпредложениями ЮГ ТРАНСФЕР.
            </p>
            <a
              href="https://t.me/ug_sait_bot"
              target="_blank"
              rel="noreferrer"
              className="grad-btn rounded-xl px-6 py-3.5 font-semibold inline-flex items-center gap-2"
            >
              <Icon name="Send" size={18} />
              Открыть бота
            </a>
          </div>
        </div>

        <div className="card-glow rounded-2xl p-8">
          <h3 className="font-oswald text-2xl font-bold text-white mb-5">Что умеет бот</h3>
          <div className="space-y-3">
            {[
              { icon: "Zap", text: "Мгновенно соединяет с диспетчером" },
              { icon: "Calendar", text: "Ежедневные посты с акциями и контактами" },
              { icon: "MessageCircle", text: "Ответы на вопросы 24/7" },
              { icon: "Bell", text: "Уведомления о новых направлениях" },
            ].map((f) => (
              <div key={f.text} className="glass rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                  <Icon name={f.icon} size={18} className="text-white" fallback="Circle" />
                </div>
                <p className="text-sm text-white">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DriversSection() {
  const plans = [
    { name: "Неделя", price: "990 ₽", period: "7 дней", color: "from-cyan-500 to-blue-600", features: ["Все заказы", "Поддержка", "Аналитика"] },
    {
      name: "Месяц",
      price: "2 990 ₽",
      period: "30 дней",
      color: "from-purple-500 to-pink-500",
      features: ["Все заказы", "Приоритет", "Поддержка 24/7", "Скидка 15%"],
      featured: true,
    },
    {
      name: "Квартал",
      price: "7 990 ₽",
      period: "90 дней",
      color: "from-orange-500 to-red-500",
      features: ["Все заказы", "Приоритет", "Поддержка 24/7", "Скидка 25%", "Личный менеджер"],
    },
  ];

  return (
    <div>
      <SectionHeader
        title="Водителям"
        subtitle="Подключайся к платформе и получай заказы напрямую"
        icon="Briefcase"
      />

      <div className="card-glow rounded-2xl p-8 mb-8 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div>
            <h3 className="font-oswald text-3xl font-bold text-white mb-3">
              Бот <span className="grad-text">@zacazubot</span>
            </h3>
            <p className="text-muted-foreground mb-5">
              Регистрация за минуту, оплата подписки прямо в Telegram, заказы приходят сразу.
              Никаких комиссий с поездки — фиксированная подписка.
            </p>
            <a
              href="https://t.me/zacazubot"
              target="_blank"
              rel="noreferrer"
              className="grad-btn rounded-xl px-6 py-3.5 font-semibold inline-flex items-center gap-2"
            >
              <Icon name="Rocket" size={18} />
              Стать водителем
            </a>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: "Coins", label: "0% комиссии" },
              { icon: "Zap", label: "Заказы за секунды" },
              { icon: "Shield", label: "Проверенные клиенты" },
              { icon: "Headphones", label: "Поддержка 24/7" },
            ].map((b) => (
              <div key={b.label} className="glass rounded-xl p-4 text-center">
                <Icon name={b.icon} size={22} className="text-purple-400 mx-auto mb-2" fallback="Circle" />
                <p className="text-xs text-white font-medium">{b.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <h3 className="font-oswald text-2xl font-bold text-white mb-5">Тарифы подписки</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {plans.map((p) => (
          <div
            key={p.name}
            className={`card-glow rounded-2xl p-6 relative ${
              p.featured ? "border-purple-500/50 shadow-[0_0_40px_rgba(168,85,247,0.25)]" : ""
            }`}
          >
            {p.featured && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 grad-btn rounded-full px-3 py-1 text-xs font-semibold">
                Популярный
              </div>
            )}
            <div
              className={`w-12 h-12 mb-4 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center shadow-lg`}
            >
              <Icon name="Star" size={20} className="text-white" />
            </div>
            <h4 className="font-oswald text-2xl font-bold text-white">{p.name}</h4>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">{p.period}</p>
            <p className="grad-text font-oswald text-4xl font-bold mb-5">{p.price}</p>
            <ul className="space-y-2 mb-6">
              {p.features.map((f) => (
                <li key={f} className="text-sm text-muted-foreground flex items-center gap-2">
                  <Icon name="Check" size={14} className="text-green-400 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <a
              href="https://t.me/zacazubot"
              target="_blank"
              rel="noreferrer"
              className={`block text-center rounded-xl py-3 font-semibold transition-all ${
                p.featured
                  ? "grad-btn"
                  : "glass border border-white/10 hover:border-purple-500/50 text-white"
              }`}
            >
              Подключить
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle, icon }: { title: string; subtitle: string; icon: string }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
          <Icon name={icon} size={20} className="text-white" fallback="Circle" />
        </div>
        <h2 className="font-oswald text-3xl md:text-4xl font-bold text-white">{title}</h2>
      </div>
      <p className="text-muted-foreground ml-13 pl-1">{subtitle}</p>
    </div>
  );
}
