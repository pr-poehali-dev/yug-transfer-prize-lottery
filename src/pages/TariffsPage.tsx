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
    image: `${CDN}/37783ff2-4000-491b-91b4-9f9612ae5668.jpg`,
  },
  {
    name: "Стандарт",
    desc: "Оптимальное сочетание цены и комфорта. В машине есть всё необходимое",
    price: "30 ₽/км",
    pax: "до 4 чел.",
    image: `${CDN}/1f34236a-8627-4b43-aa0c-9600e2ec0e93.jpg`,
  },
  {
    name: "Комфорт",
    desc: "Идеальный выбор для тех, кто ценит удобство. Просторный салон и дополнительные опции",
    price: "40 ₽/км",
    pax: "до 4 чел.",
    image: `${CDN}/161d06a8-23e5-49c5-95cd-c3b668e27c9e.jpg`,
  },
  {
    name: "Бизнес",
    desc: "Премиум-класс для деловых поездок. Стильный автомобиль с повышенным комфортом",
    price: "80 ₽/км",
    pax: "до 4 чел.",
    image: `${CDN}/30690171-f6fe-441c-a86c-006ceba1d8b9.jpg`,
  },
  {
    name: "Минивэн",
    desc: "Отличный вариант для большой компании. Вместительный салон и комфорт для всех пассажиров",
    price: "60 ₽/км",
    pax: "до 7 чел.",
    image: `${CDN}/c2ae78de-4287-4158-a4e6-d5716003afaa.jpg`,
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
            <div className="relative h-44 overflow-hidden bg-gradient-to-b from-white/[0.07] to-transparent flex items-center justify-center p-2">
              <img src={t.image} alt={t.name} loading="lazy" className="w-full h-full object-contain" />
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