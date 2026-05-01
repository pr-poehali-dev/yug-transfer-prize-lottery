import Icon from "@/components/ui/icon";
import { SectionHeader } from "./shared";

export function DriversSection() {
  const advantages = [
    { icon: "Coins", title: "Без комиссий с поездки", desc: "Фиксированная подписка — оставляйте 100% выручки себе." },
    { icon: "Zap", title: "Заказы напрямую", desc: "Получайте заявки в Telegram через секунды после оформления." },
    { icon: "MapPin", title: "Юг России и Крым", desc: "Ялта, Сочи, Адлер, Краснодар, Симферополь — стабильный поток." },
    { icon: "Shield", title: "Проверенные клиенты", desc: "Все пассажиры авторизованы, споров и кидалова нет." },
    { icon: "TrendingUp", title: "Рост дохода", desc: "В среднем водители выходят на 80–150 тыс. ₽ в месяц." },
    { icon: "Headphones", title: "Поддержка 24/7", desc: "Диспетчер всегда на связи — поможет с любым вопросом." },
  ];

  const requirements = [
    "Российские права категории B, стаж от 3 лет",
    "Авто не старше 10 лет, в чистом и исправном состоянии",
    "Смартфон с Telegram",
    "Без судимостей и серьёзных нарушений ПДД",
    "Готовность работать вежливо и пунктуально",
  ];

  const docs = [
    { icon: "FileText", label: "Паспорт" },
    { icon: "IdCard", label: "Водительское удостоверение" },
    { icon: "Car", label: "СТС автомобиля" },
    { icon: "ShieldCheck", label: "Полис ОСАГО" },
  ];

  const steps = [
    { n: "01", title: "Заявка в Telegram", desc: "Откройте @zacazubot и нажмите «Стать водителем» — заполнение займёт минуту." },
    { n: "02", title: "Проверка документов", desc: "Менеджер проверит данные за 1–2 часа в рабочее время." },
    { n: "03", title: "Оплата подписки", desc: "Выберите тариф — оплата прямо в Telegram, без карт и сторонних сайтов." },
    { n: "04", title: "Первый заказ", desc: "После активации заказы начнут поступать сразу — забирайте подходящие." },
  ];

  return (
    <div>
      <SectionHeader
        title="Стать водителем"
        subtitle="Подключайтесь к ЮГ ТРАНСФЕР и получайте заказы напрямую"
        icon="Rocket"
      />

      {/* Hero */}
      <div className="card-glow rounded-2xl p-6 md:p-10 mb-10 relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-orange-500/20 blur-3xl animate-pulse-glow" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-purple-500/15 blur-3xl" />
        <div className="absolute top-8 right-8 text-7xl animate-float opacity-20 hidden md:block">🚖</div>

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-green-500/30 text-xs text-green-300 mb-5">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Набираем водителей · Юг России и Крым
          </div>

          <h2 className="font-oswald text-3xl md:text-5xl font-bold leading-tight text-white mb-4">
            Зарабатывайте <span className="grad-text">без комиссий</span> <br />
            с приложением ЮГ ТРАНСФЕР
          </h2>
          <p className="text-muted-foreground text-base md:text-lg mb-7 max-w-2xl">
            Получайте заказы на трансферы по Югу России и Крыму прямо в Telegram.
            Никаких процентов с поездки — только фиксированная подписка.
          </p>

          <div className="flex flex-wrap gap-3">
            <a
              href="https://t.me/zacazubot"
              target="_blank"
              rel="noreferrer"
              className="grad-btn rounded-xl px-6 py-3.5 font-semibold flex items-center gap-2"
            >
              <Icon name="Send" size={18} />
              Стать водителем
            </a>
            <a
              href="tel:+79180295672"
              className="glass border border-white/10 hover:border-purple-500/50 rounded-xl px-6 py-3.5 font-semibold text-white transition-all flex items-center gap-2"
            >
              <Icon name="Phone" size={18} />
              Позвонить
            </a>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-8 max-w-xl">
            {[
              { v: "100%", l: "выручки" },
              { v: "120+", l: "водителей" },
              { v: "24/7", l: "поддержка" },
            ].map((s) => (
              <div key={s.l} className="glass rounded-xl p-4 text-center">
                <p className="grad-text font-oswald text-2xl md:text-3xl font-bold">{s.v}</p>
                <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider mt-1">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Advantages */}
      <h3 className="font-oswald text-2xl md:text-3xl font-bold text-white mb-5 flex items-center gap-2">
        <Icon name="Sparkles" size={22} className="text-purple-400" />
        Почему водители выбирают нас
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
        {advantages.map((a, i) => (
          <div
            key={a.title}
            className="card-glow rounded-2xl p-5 opacity-0-init animate-fade-in-up"
            style={{ animationDelay: `${i * 0.06}s`, animationFillMode: "forwards" }}
          >
            <div className="w-12 h-12 mb-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
              <Icon name={a.icon} size={20} className="text-white" fallback="Circle" />
            </div>
            <h4 className="font-oswald text-lg font-bold text-white mb-1.5">{a.title}</h4>
            <p className="text-sm text-muted-foreground">{a.desc}</p>
          </div>
        ))}
      </div>

      {/* How it works */}
      <h3 className="font-oswald text-2xl md:text-3xl font-bold text-white mb-5 flex items-center gap-2">
        <Icon name="Route" size={22} className="text-cyan-400" />
        Как подключиться
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        {steps.map((s, i) => (
          <div key={s.n} className="card-glow rounded-2xl p-5 relative">
            <div className="absolute top-3 right-4 font-oswald text-4xl font-bold text-purple-500/20">{s.n}</div>
            <div className="w-10 h-10 mb-3 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
              <Icon name={["UserPlus", "ScanLine", "CreditCard", "Car"][i]} size={18} className="text-white" />
            </div>
            <h4 className="font-oswald text-lg font-bold text-white mb-1.5">{s.title}</h4>
            <p className="text-sm text-muted-foreground">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Requirements + Docs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-12">
        <div className="card-glow rounded-2xl p-6">
          <h3 className="font-oswald text-2xl font-bold text-white mb-5 flex items-center gap-2">
            <Icon name="ListChecks" size={20} className="text-green-400" />
            Требования
          </h3>
          <ul className="space-y-3">
            {requirements.map((r) => (
              <li key={r} className="flex items-start gap-3 glass rounded-xl p-3">
                <Icon name="Check" size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-white">{r}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card-glow rounded-2xl p-6">
          <h3 className="font-oswald text-2xl font-bold text-white mb-5 flex items-center gap-2">
            <Icon name="Folder" size={20} className="text-yellow-400" />
            Документы
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {docs.map((d) => (
              <div key={d.label} className="glass rounded-xl p-4 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center mb-2 shadow-lg">
                  <Icon name={d.icon} size={20} className="text-white" fallback="FileText" />
                </div>
                <p className="text-xs text-white font-medium">{d.label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Все документы можно прислать прямо в чат бота — фото или PDF.
          </p>
        </div>
      </div>

    </div>
  );
}
