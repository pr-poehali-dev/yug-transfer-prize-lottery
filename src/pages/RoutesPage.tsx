import { Link } from "react-router-dom";
import PageShell from "@/components/PageShell";
import Icon from "@/components/ui/icon";
import useSEO from "@/hooks/useSEO";
import { ROUTES } from "@/data/routesData";

export default function RoutesPage() {
  useSEO({
    title: "Направления трансфера: Краснодар, Сочи, Анапа, Геленджик — цены и время в пути",
    description:
      "Популярные направления трансфера по Краснодарскому краю и побережью: Краснодар — Сочи, Анапа, Геленджик, Новороссийск. Время в пути и цены от перевозчика. Закажите машину онлайн.",
  });

  return (
    <PageShell title="Направления" icon="Route">
      <p className="text-white/70 mb-6">Популярные направления трансфера. Нажмите на маршрут — увидите цены, время в пути и сможете заказать.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {ROUTES.map((r) => (
          <Link
            key={r.slug}
            to={`/route/${r.slug}`}
            className="group bg-[#1a1a1a]/95 rounded-2xl border border-white/10 p-4 hover:border-amber-500/50 transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-white font-semibold">
                <Icon name="MapPin" size={16} className="text-amber-400" />
                {r.from} → {r.to}
              </div>
              <Icon name="ChevronRight" size={18} className="text-white/30 group-hover:text-amber-400 transition-colors" />
            </div>
            <div className="flex items-center justify-between mt-2 text-sm">
              <span className="text-white/50">{r.time} · {r.distance}</span>
              <span className="text-amber-400 font-bold">{r.priceFrom}</span>
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
