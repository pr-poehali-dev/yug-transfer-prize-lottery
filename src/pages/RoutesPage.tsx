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
            className="group bg-[#1a1a1a]/95 rounded-2xl border border-white/10 overflow-hidden hover:border-amber-500/50 transition-colors"
          >
            <div className="relative h-36 overflow-hidden">
              <img
                src={r.image}
                alt={`${r.from} — ${r.to}`}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-[#1a1a1a]/20 to-transparent" />
              <span className="absolute top-2.5 right-2.5 bg-amber-500 text-black text-xs font-bold px-2.5 py-1 rounded-lg">{r.priceFrom}</span>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-white font-semibold">
                  <Icon name="MapPin" size={16} className="text-amber-400" />
                  {r.from} → {r.to}
                </div>
                <Icon name="ChevronRight" size={18} className="text-white/30 group-hover:text-amber-400 transition-colors" />
              </div>
              <div className="mt-2 text-sm text-white/50">{r.time} · {r.distance}</div>
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