import Icon from "@/components/ui/icon";
import { SectionHeader } from "./shared";

const STORES = [
  {
    name: "Google Play",
    icon: "Play",
    href: "https://play.google.com/store/apps/details?id=com.grigor.ugdriver",
    color: "from-green-500 to-emerald-600",
    sub: "для Android",
  },
  {
    name: "App Store",
    icon: "Apple",
    href: "https://apps.apple.com/ru/app/ug-driver/id6502955527",
    color: "from-slate-400 to-slate-600",
    sub: "для iOS",
  },
  {
    name: "RuStore",
    icon: "Store",
    href: "https://www.rustore.ru/catalog/app/com.grigor.ugdriver",
    color: "from-cyan-500 to-blue-600",
    sub: "Россия",
  },
];

function DownloadButtons({ size = "md" }: { size?: "md" | "lg" }) {
  const pad = size === "lg" ? "px-5 py-4" : "px-4 py-3";
  const iconSize = size === "lg" ? 22 : 18;
  return (
    <div className="flex flex-wrap gap-3">
      {STORES.map((s) => (
        <a
          key={s.name}
          href={s.href}
          target="_blank"
          rel="noreferrer"
          className={`glass border border-white/10 hover:border-purple-500/50 rounded-xl ${pad} text-white transition-all flex items-center gap-3 group`}
        >
          <div
            className={`w-10 h-10 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}
          >
            <Icon name={s.icon} size={iconSize} className="text-white" fallback="Download" />
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
  );
}

export function DriversSection() {
  const advantages = [
    {
      icon: "TrendingUp",
      title: "Стабильная работа",
      desc: "У нас всегда есть заказы. Все водители имеют постоянный поток и стабильный доход. Работайте без простоев и увеличивайте заработок каждый день.",
      color: "from-purple-500 to-pink-500",
    },
    {
      icon: "Wallet",
      title: "Прозрачные выплаты",
      desc: "Все расчёты и выплаты прозрачны и понятны. Вы всегда видите, сколько заработали и когда получите выплату.",
      color: "from-cyan-500 to-blue-600",
    },
    {
      icon: "Smartphone",
      title: "Удобное приложение",
      desc: "Интуитивно понятный интерфейс, быстрая работа и все нужные функции в одном приложении. Управляйте заказами легко и эффективно.",
      color: "from-orange-500 to-red-500",
    },
  ];

  const perks = [
    { icon: "Zap", text: "Быстрая регистрация" },
    { icon: "Rocket", text: "Первые заказы получишь уже сегодня" },
    { icon: "Headphones", text: "Поддержка всегда на связи, 24/7" },
  ];

  return (
    <div>
      <SectionHeader
        title="Стать водителем"
        subtitle="Скачай приложение UG-Driver и начни зарабатывать уже сегодня"
        icon="Rocket"
      />

      {/* Hero */}
      <div className="card-glow rounded-3xl p-6 md:p-12 mb-12 relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-orange-500/20 blur-3xl animate-pulse-glow" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-purple-500/15 blur-3xl" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-green-500/30 text-xs text-green-300 mb-5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              UG-Driver · приложение для водителей
            </div>

            <h2 className="font-oswald text-3xl md:text-5xl font-bold leading-tight text-white mb-4">
              Скачай приложение <br />
              <span className="grad-text">«Юг-Трансфер»</span> для водителя
            </h2>
            <p className="text-muted-foreground text-base md:text-lg mb-7">
              И начни зарабатывать уже сегодня. Регистрация занимает минуту,
              первые заказы приходят в тот же день.
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

            <DownloadButtons size="lg" />
          </div>

          {/* Phone mockup */}
          <div className="hidden lg:flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/30 to-pink-500/30 blur-3xl scale-90" />
              <div className="relative w-64 h-[520px] rounded-[3rem] glass border-2 border-white/20 p-3 shadow-2xl animate-float">
                <div className="w-full h-full rounded-[2.3rem] bg-gradient-to-br from-purple-900/60 via-slate-900 to-cyan-900/60 flex flex-col items-center justify-center p-6 relative overflow-hidden">
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-5 rounded-full bg-black" />
                  <div className="text-7xl mb-4 animate-pulse-glow">🚖</div>
                  <p className="font-oswald text-3xl font-bold text-white mb-1">UG-Driver</p>
                  <p className="text-xs text-purple-300 mb-6 uppercase tracking-wider">Юг-Трансфер</p>
                  <div className="w-full space-y-2">
                    <div className="glass rounded-xl p-3">
                      <div className="h-2 w-1/2 bg-purple-400/60 rounded mb-2" />
                      <div className="h-1.5 w-3/4 bg-white/20 rounded" />
                    </div>
                    <div className="glass rounded-xl p-3">
                      <div className="h-2 w-2/3 bg-cyan-400/60 rounded mb-2" />
                      <div className="h-1.5 w-1/2 bg-white/20 rounded" />
                    </div>
                    <div className="grad-btn rounded-xl py-2.5 text-center text-xs font-bold">
                      Принять заказ
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Advantages */}
      <h3 className="font-oswald text-2xl md:text-3xl font-bold text-white mb-5 flex items-center gap-2">
        <Icon name="Sparkles" size={22} className="text-purple-400" />
        Преимущества работы с нами
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
        {advantages.map((a, i) => (
          <div
            key={a.title}
            className="card-glow rounded-2xl p-6 opacity-0-init animate-fade-in-up"
            style={{ animationDelay: `${i * 0.08}s`, animationFillMode: "forwards" }}
          >
            <div
              className={`w-14 h-14 mb-4 rounded-2xl bg-gradient-to-br ${a.color} flex items-center justify-center shadow-lg`}
            >
              <Icon name={a.icon} size={26} className="text-white" fallback="Circle" />
            </div>
            <h4 className="font-oswald text-xl font-bold text-white mb-2">{a.title}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">{a.desc}</p>
          </div>
        ))}
      </div>

      {/* Final CTA */}
      <div className="card-glow rounded-3xl p-8 md:p-12 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10" />
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="relative z-10">
          <div className="text-5xl mb-4 animate-float">🚀</div>
          <h3 className="font-oswald text-2xl md:text-4xl font-bold text-white mb-3">
            Начните зарабатывать уже сегодня
          </h3>
          <p className="text-muted-foreground mb-7 max-w-xl mx-auto">
            Скачайте приложение и присоединяйтесь к нашей команде
          </p>
          <div className="flex justify-center">
            <DownloadButtons size="lg" />
          </div>
        </div>
      </div>
    </div>
  );
}