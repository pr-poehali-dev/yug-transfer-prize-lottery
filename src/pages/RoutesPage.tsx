import { Link } from "react-router-dom";
import PageShell from "@/components/PageShell";
import Icon from "@/components/ui/icon";

const ROUTES = [
  { from: "Краснодар", to: "Сочи", time: "≈ 4 ч", price: "от 6 000 ₽" },
  { from: "Краснодар", to: "Анапа", time: "≈ 2.5 ч", price: "от 4 000 ₽" },
  { from: "Краснодар", to: "Геленджик", time: "≈ 2.5 ч", price: "от 4 500 ₽" },
  { from: "Краснодар", to: "Новороссийск", time: "≈ 2 ч", price: "от 3 800 ₽" },
  { from: "Сочи", to: "Аэропорт Адлер", time: "≈ 40 мин", price: "от 1 500 ₽" },
  { from: "Краснодар", to: "Кабардинка", time: "≈ 2.5 ч", price: "от 4 500 ₽" },
];

export default function RoutesPage() {
  return (
    <PageShell title="Маршруты" icon="Route">
      <p className="text-white/70 mb-6">Популярные направления трансфера. Точную стоимость рассчитаем под ваш заказ.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {ROUTES.map((r) => (
          <div key={`${r.from}-${r.to}`} className="bg-[#1a1a1a]/95 rounded-2xl border border-white/10 p-4">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Icon name="MapPin" size={16} className="text-amber-400" />
              {r.from} → {r.to}
            </div>
            <div className="flex items-center justify-between mt-2 text-sm">
              <span className="text-white/50">{r.time}</span>
              <span className="text-amber-400 font-bold">{r.price}</span>
            </div>
          </div>
        ))}
      </div>
      <Link to="/" className="inline-flex items-center gap-2 mt-7 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold transition-colors">
        <Icon name="Plus" size={18} /> Заказать трансфер
      </Link>
    </PageShell>
  );
}
