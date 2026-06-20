import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageShell from "@/components/PageShell";
import Icon from "@/components/ui/icon";
import useSEO from "@/hooks/useSEO";
import { ROUTES, REGIONS, getRegion, type Region } from "@/data/routesData";

export default function RoutesPage() {
  useSEO({
    title: "Направления трансфера: Краснодар, Сочи, Анапа, Геленджик — цены и время в пути",
    description:
      "Популярные направления трансфера по Краснодарскому краю и побережью: Краснодар — Сочи, Анапа, Геленджик, Новороссийск. Время в пути и цены от перевозчика. Закажите машину онлайн.",
  });

  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<Region>("Все");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ROUTES.filter((r) => {
      const okRegion = region === "Все" || getRegion(r.slug) === region;
      const okQuery = !q || `${r.from} ${r.to}`.toLowerCase().includes(q);
      return okRegion && okQuery;
    });
  }, [query, region]);

  return (
    <PageShell title="Направления" icon="Route">
      <p className="text-white/70 mb-4">Популярные направления трансфера. Нажмите на маршрут — увидите цены, время в пути и сможете заказать.</p>

      <div className="relative mb-3">
        <Icon name="Search" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по городу: Сочи, Ялта, Анапа…"
          className="w-full bg-[#1a1a1a]/95 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white placeholder-white/35 text-sm outline-none focus:border-amber-500/60"
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {REGIONS.map((reg) => (
          <button
            key={reg}
            onClick={() => setRegion(reg)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
              region === reg
                ? "bg-amber-500 text-black"
                : "bg-[#1a1a1a]/95 border border-white/10 text-white/70 hover:text-white hover:border-white/30"
            }`}
          >
            {reg}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-white/50 py-10 text-center">Ничего не найдено. Попробуйте другой город или регион.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map((r) => (
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
      )}

      <Link to="/" className="inline-flex items-center gap-2 mt-7 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold transition-colors">
        <Icon name="Plus" size={18} /> Заказать трансфер
      </Link>
    </PageShell>
  );
}
