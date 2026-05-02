import Icon from "@/components/ui/icon";
import { Section } from "./shared";
import { OrderForm } from "./OrderForm";

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

export function HomeSection({ onNav }: { onNav: (s: Section) => void }) {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl glass border border-white/10 p-6 md:p-10">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-purple-500/20 blur-3xl animate-pulse-glow" />
        <div className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full bg-cyan-500/15 blur-3xl" />

        <img
          src="https://cdn.poehali.dev/files/67b1710e-13db-49da-a319-264e54d63c57.png"
          alt="ЮГ ТРАНСФЕР"
          className="absolute top-6 right-6 md:top-8 md:right-8 h-10 md:h-16 w-auto z-10 drop-shadow-[0_0_25px_rgba(255,140,40,0.45)]"
        />

        <div className="relative z-10 grid lg:grid-cols-[1fr_auto] gap-8 items-start pt-16 md:pt-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-purple-500/30 text-xs text-purple-300 mb-5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              На связи 24/7 · приём заказов
            </div>

            <h1 className="font-oswald text-3xl md:text-5xl font-bold leading-tight text-white mb-4">
              Трансферы по югу <br />
              на <span className="grad-text">световой</span> скорости
            </h1>
            <p className="text-muted-foreground text-sm md:text-base mb-6 max-w-2xl">
              Аэропорты, межгород, по Краснодарскому краю и Крыму. Комфортные авто,
              проверенные водители, фиксированная цена. Бронируй за минуту.
            </p>

            <div className="flex flex-wrap gap-3">
              <a
                href="https://t.me/ug_transfer_online"
                target="_blank"
                rel="noreferrer"
                className="grad-btn rounded-xl px-5 py-3 font-semibold flex items-center gap-2 text-sm"
              >
                <Icon name="Send" size={16} />
                Заказать в Telegram
              </a>
              <button
                onClick={() => onNav("services")}
                className="glass border border-white/10 hover:border-purple-500/50 rounded-xl px-5 py-3 font-semibold text-white transition-all flex items-center gap-2 text-sm"
              >
                <Icon name="Compass" size={16} />
                Услуги
              </button>
            </div>
          </div>

          {/* Форма заказа */}
          <div className="w-full lg:w-auto flex lg:justify-end justify-center">
            <OrderForm />
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