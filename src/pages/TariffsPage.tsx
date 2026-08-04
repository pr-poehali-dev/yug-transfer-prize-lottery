import { Link } from "react-router-dom";
import PageShell from "@/components/PageShell";
import Icon from "@/components/ui/icon";
import useSEO from "@/hooks/useSEO";
import { TARIFFS } from "@/data/tariffsData";

export default function TariffsPage() {
  useSEO({
    title: "Тарифы на трансфер и такси: Стандарт, Комфорт, Бизнес, Минивэн, Доставка — цены за км",
    description:
      "Тарифы на трансфер и такси: Стандарт от 30 ₽/км, Комфорт, Бизнес, Минивэн до 7 мест и доставка посылок от 2000 ₽. Фиксированная цена без накруток, детское кресло бесплатно. Рассчитаем стоимость поездки при заказе.",
  });

  return (
    <PageShell title="Тарифы" icon="Wallet" maxWidth="max-w-7xl" hideContactWidget>
      <p className="text-white/70 mb-4">Выберите класс автомобиля под вашу поездку. Итоговую цену рассчитаем при оформлении заявки.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:pb-8">
        {TARIFFS.map((t) => (
          <Link
            key={t.name}
            to={`/tariff/${t.slug}`}
            className="group bg-[#1a1a1a]/95 rounded-2xl border border-white/10 overflow-hidden hover:border-amber-500/50 transition-colors"
          >
            <div className="relative h-52 overflow-hidden">
              <img
                src={t.image}
                alt={t.name}
                loading="lazy"
                className={`w-full h-full object-cover transition-transform duration-500 ${
                  t.objectTop ? "object-top" : ""
                } ${
                  t.flip
                    ? "scale-x-[-1] group-hover:scale-x-[-1.05] group-hover:scale-y-[1.05]"
                    : "group-hover:scale-105"
                }`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-[#1a1a1a]/20 to-transparent" />
              <span className="absolute top-3 right-3 bg-amber-500 text-black text-sm font-bold px-3 py-1.5 rounded-lg">{t.price}</span>
              <span className="absolute top-3 left-3 bg-black/70 text-white text-sm font-semibold px-3 py-1.5 rounded-lg">{t.pax}</span>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-white font-bold text-lg uppercase tracking-wide">
                  <Icon name={t.icon ?? "Car"} size={18} className="text-amber-400 shrink-0" />
                  {t.name}
                </div>
                <Icon name="ChevronRight" size={20} className="text-white/30 group-hover:text-amber-400 transition-colors shrink-0" />
              </div>
              <p className="text-white/55 text-sm mt-2.5 leading-snug">{t.desc}</p>
            </div>
          </Link>
        ))}
      </div>
      <Link to="/" className="inline-flex items-center gap-2 mt-7 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold transition-colors">
        <Icon name="Plus" size={18} /> Заказать трансфер
      </Link>
    </PageShell>
  );
}