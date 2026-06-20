import { Link } from "react-router-dom";
import PageShell from "@/components/PageShell";
import Icon from "@/components/ui/icon";
import useSEO from "@/hooks/useSEO";

const CDN = "https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files";

const TARIFFS = [
  {
    name: "Срочный",
    desc: "Автомобиль тарифа «Стандарт», но с максимально быстрой подачей",
    price: "30 ₽/км + 1000 ₽",
    pax: "до 4 чел.",
    image: `${CDN}/db2d05eb-7a21-43e5-a2cf-f6b6519d1079.jpg`,
  },
  {
    name: "Стандарт",
    desc: "Оптимальное сочетание цены и комфорта. В машине есть всё необходимое",
    price: "30 ₽/км",
    pax: "до 4 чел.",
    image: `${CDN}/b6ee65fb-58f9-4c5d-a5ce-6e176c59a072.jpg`,
  },
  {
    name: "Комфорт",
    desc: "Идеальный выбор для тех, кто ценит удобство. Просторный салон и дополнительные опции",
    price: "40 ₽/км",
    pax: "до 4 чел.",
    image: `${CDN}/23bb9a44-abb8-40d9-9df5-8ec5834179cb.jpg`,
  },
  {
    name: "Бизнес",
    desc: "Премиум-класс для деловых поездок. Стильный автомобиль с повышенным комфортом",
    price: "80 ₽/км",
    pax: "до 4 чел.",
    image: `${CDN}/539c8b79-62d8-4b5e-9f2f-6e91d5dc454e.jpg`,
  },
  {
    name: "Минивэн",
    desc: "Отличный вариант для большой компании. Вместительный салон и комфорт для всех пассажиров",
    price: "60 ₽/км",
    pax: "до 7 чел.",
    image: `${CDN}/6e0e6f6f-053c-4fc7-9349-bd6fec80c05d.jpg`,
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
      <p className="text-white/70 mb-6 text-sm md:text-base">Выберите класс автомобиля под вашу поездку. Итоговую цену рассчитаем при оформлении заявки.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TARIFFS.map((t) => (
          <div key={t.name} className="bg-[#1a1a1a]/95 rounded-2xl border border-white/10 overflow-hidden flex flex-col">
            <div className="relative h-40 overflow-hidden">
              <img src={t.image} alt={t.name} loading="lazy" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-transparent to-transparent" />
              <span className="absolute top-2.5 right-2.5 bg-black/70 text-white text-xs font-semibold px-2.5 py-1 rounded-lg">{t.pax}</span>
            </div>
            <div className="p-4 flex flex-col flex-1">
              <div className="text-white font-bold text-lg uppercase tracking-wide">{t.name}</div>
              <p className="text-white/60 text-sm mt-1.5 leading-snug flex-1">{t.desc}</p>
              <div className="text-amber-400 font-bold text-lg mt-3">{t.price}</div>
            </div>
          </div>
        ))}
        <Link to="/" className="flex flex-col items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-2xl p-6 transition-colors min-h-[200px]">
          <Icon name="Plus" size={28} />
          <span className="text-lg">Заказать трансфер</span>
        </Link>
      </div>
    </PageShell>
  );
}
