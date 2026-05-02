import Icon from "@/components/ui/icon";
import { Section } from "./shared";
import { OrderForm } from "./OrderForm";

export function HomeSection({ onNav }: { onNav: (s: Section) => void }) {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl glass border border-white/10 p-4 md:p-6">
        <div className="absolute -top-24 -right-24 w-60 h-60 rounded-full bg-purple-500/20 blur-3xl animate-pulse-glow" />
        <div className="absolute -bottom-32 -left-20 w-72 h-72 rounded-full bg-cyan-500/15 blur-3xl" />

        <img
          src="https://cdn.poehali.dev/files/67b1710e-13db-49da-a319-264e54d63c57.png"
          alt="ЮГ ТРАНСФЕР"
          className="absolute top-4 right-4 md:top-5 md:right-5 h-8 md:h-12 w-auto z-10 drop-shadow-[0_0_25px_rgba(255,140,40,0.45)]"
        />

        <div className="relative z-10 grid lg:grid-cols-[1fr_auto] gap-5 items-center pt-12 md:pt-2">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full glass border border-purple-500/30 text-[11px] text-purple-300 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              На связи 24/7 · приём заказов
            </div>

            <h1 className="font-oswald text-2xl md:text-4xl font-bold leading-tight text-white mb-2">
              Трансферы по югу <br />
              на <span className="grad-text">световой</span> скорости
            </h1>
            <p className="text-muted-foreground text-xs md:text-sm mb-4 max-w-2xl">
              Аэропорты, межгород, по Краснодарскому краю и Крыму. Комфортные авто,
              проверенные водители, фиксированная цена.
            </p>

            <div className="flex flex-wrap gap-2">
              <a
                href="https://t.me/ug_transfer_online"
                target="_blank"
                rel="noreferrer"
                className="grad-btn rounded-xl px-4 py-2.5 font-semibold flex items-center gap-2 text-sm"
              >
                <Icon name="Send" size={14} />
                Заказать в Telegram
              </a>
              <button
                onClick={() => onNav("services")}
                className="glass border border-white/10 hover:border-purple-500/50 rounded-xl px-4 py-2.5 font-semibold text-white transition-all flex items-center gap-2 text-sm"
              >
                <Icon name="Compass" size={14} />
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