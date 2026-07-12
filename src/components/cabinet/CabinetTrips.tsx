import { useState } from "react";
import Icon from "@/components/ui/icon";
import { ClientRequest, STATUS_STYLE } from "./cabinetShared";

/* ---------------- TRIPS TAB ---------------- */
export default function TripsTab({
  requests, activeOrders, onNew,
}: {
  requests: ClientRequest[];
  activeOrders: ClientRequest[];
  onNew: () => void;
}) {
  const [filter, setFilter] = useState<"active" | "all">("active");
  const list = filter === "active" ? activeOrders : requests;
  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Мои поездки</h1>
        <button
          onClick={onNew}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl px-4 py-2.5 transition-colors"
        >
          <Icon name="Plus" size={18} /> Новый заказ
        </button>
      </div>

      <div className="inline-flex bg-[#161616] border border-white/10 rounded-xl p-1 mb-5">
        {([
          { k: "active", label: `Активные (${activeOrders.length})` },
          { k: "all", label: `Все (${requests.length})` },
        ] as const).map((t) => (
          <button
            key={t.k}
            onClick={() => setFilter(t.k)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === t.k ? "bg-amber-500 text-black" : "text-white/60 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="bg-[#161616] rounded-2xl border border-white/10 p-12 text-center">
          <Icon name="MapPinned" size={46} className="text-amber-400 mx-auto mb-3" />
          <div className="text-white font-bold text-lg">
            {filter === "active" ? "Активных поездок нет" : "Поездок пока нет"}
          </div>
          <div className="text-white/50 text-sm mt-1">Оформите первый заказ — он появится здесь</div>
          <button
            onClick={onNew}
            className="mt-5 inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl px-5 py-2.5 transition-colors"
          >
            <Icon name="Plus" size={18} /> Заказать поездку
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {list.map((req) => (
            <div key={req.id} className="rounded-2xl border border-white/10 bg-[#161616] p-4 hover:border-amber-500/30 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-semibold">Заказ №{req.id}</span>
                <span className={`text-xs px-2.5 py-1 rounded-full border ${STATUS_STYLE[req.status] || "bg-white/10 text-white/70 border-white/20"}`}>
                  {req.status_label}
                </span>
              </div>
              <div className="flex items-start gap-2 text-white/90 text-sm mb-3">
                <Icon name="MapPin" size={16} className="text-amber-400 mt-0.5 shrink-0" />
                <span>{req.from_city} <span className="text-white/40">→</span> {req.to_city}</span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-white/50 text-xs">
                {(req.trip_date || req.trip_time) && <span>📅 {req.trip_date} {req.trip_time}</span>}
                {req.tariff && <span>🎫 {req.tariff}</span>}
                {req.people && <span>👤 {req.people}</span>}
                {req.baggage && <span>🧳 {req.baggage}</span>}
              </div>
              {req.comment && <div className="text-white/40 text-xs mt-2 border-t border-white/5 pt-2">💬 {req.comment}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
