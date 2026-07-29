import { Link } from "react-router-dom";
import PageShell from "@/components/PageShell";
import Icon from "@/components/ui/icon";
import useSEO from "@/hooks/useSEO";

const TARIFFS = [
  {
    name: "Срочный",
    desc: "Автомобиль тарифа «Стандарт», но с максимально быстрой подачей",
    price: "30 ₽/км + 1000 ₽",
    pax: "до 4 чел.",
    image: "/tariff-srochny.jpg",
  },
  {
    name: "Стандарт",
    desc: "Оптимальное сочетание цены и комфорта. В машине есть всё необходимое",
    price: "30 ₽/км",
    pax: "до 4 чел.",
    image: "/tariff-standart.jpg",
  },
  {
    name: "Комфорт",
    desc: "Идеальный выбор для тех, кто ценит удобство. Просторный салон и дополнительные опции",
    price: "40 ₽/км",
    pax: "до 4 чел.",
    image: "/tariff-komfort.jpg",
  },
  {
    name: "Бизнес",
    desc: "Премиум-класс для деловых поездок. Стильный автомобиль с повышенным комфортом",
    price: "80 ₽/км",
    pax: "до 4 чел.",
    image: "/tariff-biznes.jpg",
    flip: true,
  },
  {
    name: "Минивэн",
    desc: "Отличный вариант для большой компании. Вместительный салон и комфорт для всех пассажиров",
    price: "60 ₽/км",
    pax: "до 7 чел.",
    image: "/tariff-minivan.jpg",
    flip: true,
  },
];

export default function TariffsPage() {
  useSEO({
    title: "Тарифы на трансфер и такси: Стандарт, Комфорт, Минивэн, Бизнес — цены за км",
    description:
      "Тарифы на трансфер: Стандарт от 30 ₽/км, Комфорт, Бизнес, Минивэн до 7 мест. Фиксированная цена без накруток. Рассчитаем стоимость поездки при заказе.",
  });

  return (
    <PageShell title="Тарифы" icon="Wallet">
      <p className="text-white/70 mb-4 text-sm">Выберите класс автомобиля под вашу поездку. Итоговую цену рассчитаем при оформлении заявки.</p>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
        {TARIFFS.map((t) => (
          <Link
            key={t.name}
            to="/"
            className="group bg-[#1a1a1a]/95 rounded-xl border border-white/10 overflow-hidden hover:border-amber-500/50 transition-colors flex flex-col"
          >
            <div className="relative h-24 sm:h-28 overflow-hidden">
              <img
                src={t.image}
                alt={t.name}
                loading="lazy"
                className={`w-full h-full object-cover transition-transform duration-500 ${
                  t.flip
                    ? "scale-x-[-1] group-hover:scale-x-[-1.05] group-hover:scale-y-[1.05]"
                    : "group-hover:scale-105"
                }`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-[#1a1a1a]/20 to-transparent" />
              <span className="absolute top-1.5 right-1.5 bg-amber-500 text-black text-[11px] font-bold px-2 py-0.5 rounded-md">{t.price}</span>
              <span className="absolute top-1.5 left-1.5 bg-black/70 text-white text-[11px] font-semibold px-2 py-0.5 rounded-md">{t.pax}</span>
            </div>
            <div className="p-2.5 flex flex-col flex-1">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 text-white font-bold text-sm uppercase tracking-wide">
                  <Icon name="Car" size={15} className="text-amber-400 shrink-0" />
                  {t.name}
                </div>
                <Icon name="ChevronRight" size={16} className="text-white/30 group-hover:text-amber-400 transition-colors shrink-0" />
              </div>
              <p className="text-white/55 text-xs mt-1 leading-snug flex-1">{t.desc}</p>
            </div>
          </Link>
        ))}
        <Link to="/" className="group bg-white rounded-xl border border-white/10 overflow-hidden hover:border-amber-500/50 transition-colors self-start">
          <div className="h-[168px] sm:h-[188px] overflow-hidden">
            <img
              src="/tariff-order.jpg"
              alt="Доставка — курьер с посылкой"
              loading="lazy"
              className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        </Link>
      </div>
    </PageShell>
  );
}