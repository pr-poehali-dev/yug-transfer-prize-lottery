import { Link } from "react-router-dom";
import PageShell from "@/components/PageShell";
import Icon from "@/components/ui/icon";

const TARIFFS = [
  { name: "Срочный", desc: "Подача в ближайшее время, приоритетный заказ", price: "по запросу", icon: "Zap" },
  { name: "Стандарт", desc: "Комфортный седан для поездок по городу и межгород", price: "от 25 ₽/км", icon: "Car" },
  { name: "Комфорт", desc: "Просторный салон, кондиционер, опытный водитель", price: "от 32 ₽/км", icon: "Sparkles" },
  { name: "Минивэн", desc: "До 7 пассажиров и большой багаж", price: "от 40 ₽/км", icon: "Bus" },
  { name: "Бизнес", desc: "Автомобили премиум-класса для особых случаев", price: "от 60 ₽/км", icon: "Crown" },
];

export default function TariffsPage() {
  return (
    <PageShell title="Тарифы" icon="Wallet">
      <p className="text-white/70 mb-6">Выберите класс автомобиля под вашу поездку. Итоговую цену рассчитаем при оформлении заявки.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {TARIFFS.map((t) => (
          <div key={t.name} className="bg-[#1a1a1a]/95 rounded-2xl border border-white/10 p-4">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Icon name={t.icon} size={18} className="text-amber-400" />
              {t.name}
            </div>
            <p className="text-white/60 text-sm mt-2">{t.desc}</p>
            <div className="text-amber-400 font-bold mt-3">{t.price}</div>
          </div>
        ))}
      </div>
      <Link to="/" className="inline-flex items-center gap-2 mt-7 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold transition-colors">
        <Icon name="Plus" size={18} /> Заказать трансфер
      </Link>
    </PageShell>
  );
}
