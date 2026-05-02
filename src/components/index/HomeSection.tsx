import Icon from "@/components/ui/icon";
import { Section } from "./shared";
import { OrderForm } from "./OrderForm";

export function HomeSection({ onNav }: { onNav: (s: Section) => void }) {
  return (
    <div>
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
    </div>
  );
}
