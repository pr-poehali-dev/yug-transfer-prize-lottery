import Icon from "@/components/ui/icon";
import { SectionHeader } from "./shared";

const CLIENT_STORES = [
  {
    name: "Google Play",
    icon: "Play",
    href: "#",
    color: "from-green-500 to-emerald-600",
    sub: "для Android",
  },
  {
    name: "App Store",
    icon: "Apple",
    href: "#",
    color: "from-slate-400 to-slate-600",
    sub: "для iOS",
  },
  {
    name: "RuStore",
    icon: "Store",
    href: "#",
    color: "from-cyan-500 to-blue-600",
    sub: "Россия",
  },
];

export function ServicesSection() {
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

  const perks = [
    { icon: "Zap", text: "Быстрый заказ межгороднего такси" },
    { icon: "MessageCircle", text: "Прямая связь с водителем" },
    { icon: "Wallet", text: "Удобная оплата и история заказов" },
  ];

  return (
    <div>
      <SectionHeader
        title="Наши услуги"
        subtitle="Выбирай направление и оформляй поездку в пару кликов"
        icon="Sparkles"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
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

      {/* Client app block */}
      <div className="card-glow rounded-3xl p-6 md:p-12 relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-purple-500/20 blur-3xl animate-pulse-glow" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-cyan-500/15 blur-3xl" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-purple-500/30 text-xs text-purple-300 mb-5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Такси Юг-Трансфер · приложение для пассажиров
            </div>

            <h2 className="font-oswald text-3xl md:text-5xl font-bold leading-tight text-white mb-4">
              Скачай приложение <br />
              <span className="grad-text">«Такси Юг-Трансфер»</span>
            </h2>
            <p className="text-muted-foreground text-base md:text-lg mb-7">
              И заказывай межгороднее такси в один клик. Все направления юга России и Крыма
              в одном приложении.
            </p>

            <div className="space-y-3 mb-7">
              {perks.map((p) => (
                <div key={p.text} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg flex-shrink-0">
                    <Icon name={p.icon} size={16} className="text-white" fallback="Check" />
                  </div>
                  <p className="text-white text-sm md:text-base">{p.text}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              {CLIENT_STORES.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="glass border border-white/10 hover:border-purple-500/50 rounded-xl px-5 py-4 text-white transition-all flex items-center gap-3 group"
                >
                  <div
                    className={`w-10 h-10 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}
                  >
                    <Icon name={s.icon} size={22} className="text-white" fallback="Download" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-none mb-1">
                      Скачать
                    </p>
                    <p className="font-oswald text-base font-bold leading-none">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{s.sub}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Phone mockup */}
          <div className="hidden lg:flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/30 to-purple-500/30 blur-3xl scale-90" />
              <div className="relative w-64 h-[520px] rounded-[3rem] glass border-2 border-white/20 p-3 shadow-2xl animate-float">
                <div className="w-full h-full rounded-[2.3rem] bg-gradient-to-br from-cyan-900/60 via-slate-900 to-purple-900/60 flex flex-col items-center justify-center p-6 relative overflow-hidden">
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-5 rounded-full bg-black" />
                  <div className="text-7xl mb-4 animate-pulse-glow">🚕</div>
                  <p className="font-oswald text-2xl font-bold text-white mb-1 text-center">
                    Такси<br />Юг-Трансфер
                  </p>
                  <p className="text-xs text-cyan-300 mb-6 uppercase tracking-wider mt-2">
                    Заказ в один клик
                  </p>
                  <div className="w-full space-y-2">
                    <div className="glass rounded-xl p-3">
                      <div className="h-2 w-2/3 bg-cyan-400/60 rounded mb-2" />
                      <div className="h-1.5 w-1/2 bg-white/20 rounded" />
                    </div>
                    <div className="glass rounded-xl p-3">
                      <div className="h-2 w-1/2 bg-purple-400/60 rounded mb-2" />
                      <div className="h-1.5 w-3/4 bg-white/20 rounded" />
                    </div>
                    <div className="grad-btn rounded-xl py-2.5 text-center text-xs font-bold">
                      Заказать такси
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
