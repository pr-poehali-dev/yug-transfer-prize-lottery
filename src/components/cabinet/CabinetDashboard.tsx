import Icon from "@/components/ui/icon";
import { ClientRequest, STATUS_STYLE } from "./cabinetShared";

/* ---------------- DASHBOARD ---------------- */
export default function DashboardTab({
  name, requests, activeCount, doneCount, points, onNew, onAllTrips,
}: {
  name: string;
  requests: ClientRequest[];
  activeCount: number;
  doneCount: number;
  points: number;
  onNew: () => void;
  onAllTrips: () => void;
}) {
  const stats = [
    { icon: "MapPinned", label: "Всего поездок", value: requests.length, color: "text-amber-400" },
    { icon: "Clock", label: "Активные", value: activeCount, color: "text-blue-400" },
    { icon: "CheckCheck", label: "Завершено", value: doneCount, color: "text-emerald-400" },
    { icon: "Gift", label: "Баллы", value: points, color: "text-amber-400" },
  ];
  const recent = requests.slice(0, 4);
  return (
    <div className="space-y-5">
      {/* greeting */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Здравствуйте, {name || "Клиент"}!</h1>
          <p className="text-white/50 text-sm mt-0.5">Добро пожаловать в личный кабинет</p>
        </div>
        <button
          onClick={onNew}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl px-4 py-2.5 transition-colors"
        >
          <Icon name="Plus" size={18} /> Новый заказ
        </button>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-[#161616] rounded-2xl border border-white/10 p-4">
            <Icon name={s.icon} size={22} className={`${s.color} mb-2`} />
            <div className="text-2xl font-bold text-white">{s.value}</div>
            <div className="text-white/50 text-sm">{s.label}</div>
          </div>
        ))}
      </div>

      {/* recent trips wide block */}
      <div className="bg-[#161616] rounded-2xl border border-white/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Последние поездки</h2>
          <button onClick={onAllTrips} className="text-amber-400 text-sm hover:text-amber-300 flex items-center gap-1">
            Все поездки <Icon name="ChevronRight" size={16} />
          </button>
        </div>
        {recent.length === 0 ? (
          <div className="text-center py-10">
            <Icon name="MapPinned" size={40} className="text-amber-400 mx-auto mb-2" />
            <div className="text-white/60">Поездок пока нет</div>
            <button onClick={onNew} className="mt-4 inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl px-4 py-2 transition-colors">
              <Icon name="Plus" size={16} /> Заказать
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {recent.map((req) => (
              <div key={req.id} className="flex items-center gap-4 py-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Icon name="MapPin" size={18} className="text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate">{req.from_city} → {req.to_city}</div>
                  <div className="text-white/40 text-xs">№{req.id} · {req.trip_date} {req.trip_time} · {req.tariff}</div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full border shrink-0 ${STATUS_STYLE[req.status] || "bg-white/10 text-white/70 border-white/20"}`}>
                  {req.status_label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* extra service blocks (в разработке) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          { icon: "CreditCard", title: "Оплата онлайн", text: "Привязка карты и оплата поездок" },
          { icon: "Star", title: "Оцените поездку", text: "Отзывы о водителях и авто" },
        ].map((b) => (
          <div key={b.title} className="relative bg-[#161616] rounded-2xl border border-white/10 p-5 overflow-hidden">
            <span className="absolute top-3 right-3 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">Скоро</span>
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-3">
              <Icon name={b.icon} size={22} className="text-amber-400" />
            </div>
            <div className="text-white font-semibold">{b.title}</div>
            <div className="text-white/45 text-sm mt-1">{b.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
