import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/icon";
import { ADMIN_DRIVER_SUBS_URL, DriverSub } from "./adminTypes";

const PLAN_LABELS: Record<string, string> = {
  month: "Месяц",
  half: "Полгода",
  year: "Год",
};

export function AdminDriversTab({ token }: { token: string }) {
  const [subs, setSubs] = useState<DriverSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalActive, setTotalActive] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);

  const fetchSubs = async () => {
    setLoading(true);
    try {
      const res = await fetch(ADMIN_DRIVER_SUBS_URL, { headers: { "X-Admin-Token": token } });
      const data = await res.json();
      if (data.ok) {
        setSubs(data.subs || []);
        setTotalActive(data.total_active || 0);
        setTotalRevenue(data.total_revenue || 0);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubs();
  }, []);

  const expiringSoon = useMemo(() => {
    const now = Date.now();
    const soon = now + 3 * 24 * 60 * 60 * 1000;
    return subs.filter(s => {
      if (s.status !== "active" || !s.expires_at) return false;
      const t = new Date(s.expires_at).getTime();
      return t > now && t <= soon;
    }).length;
  }, [subs]);

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("ru-RU");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-oswald text-3xl font-bold text-white">Подписки водителей</h2>
          <p className="text-white/40 text-sm mt-1">Бот @zacazubot · Группа Transfer Zone VIP</p>
        </div>
        <button onClick={fetchSubs} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm hover:bg-white/10 transition-colors">
          <Icon name="RefreshCw" size={14} className="inline mr-1" />Обновить
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Icon name="UserCheck" size={20} className="text-emerald-400" />
            </div>
            <span className="text-white/60 text-sm">Активных</span>
          </div>
          <p className="text-3xl font-bold text-white">{totalActive}</p>
          <p className="text-emerald-400/80 text-xs mt-1">комиссия 10%</p>
        </div>

        <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <Icon name="Clock" size={20} className="text-orange-400" />
            </div>
            <span className="text-white/60 text-sm">Истекают за 3 дня</span>
          </div>
          <p className="text-3xl font-bold text-white">{expiringSoon}</p>
          <p className="text-orange-400/80 text-xs mt-1">бот пришлёт напоминание</p>
        </div>

        <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Icon name="Wallet" size={20} className="text-purple-400" />
            </div>
            <span className="text-white/60 text-sm">Всего собрано</span>
          </div>
          <p className="text-3xl font-bold text-white">{totalRevenue.toLocaleString("ru-RU")} ₽</p>
          <p className="text-purple-400/80 text-xs mt-1">за всё время</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: "rgba(255,255,255,0.02)" }}>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : subs.length === 0 ? (
          <div className="text-center py-12 text-white/40 text-sm">
            Пока никто не оформил подписку.<br />
            Когда водители из группы оплатят — они появятся тут.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/3 border-b border-white/5">
                <tr className="text-white/50">
                  <th className="text-left px-4 py-3 font-medium">Водитель</th>
                  <th className="text-left px-4 py-3 font-medium">Тариф</th>
                  <th className="text-left px-4 py-3 font-medium">Сумма</th>
                  <th className="text-left px-4 py-3 font-medium">Действует до</th>
                  <th className="text-left px-4 py-3 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {subs.map(s => (
                  <tr key={s.id} className="border-b border-white/5 last:border-0 hover:bg-white/3">
                    <td className="px-4 py-3">
                      <div className="text-white">{s.first_name || "—"}</div>
                      {s.username && (
                        <a href={`https://t.me/${s.username}`} target="_blank" rel="noreferrer" className="text-purple-400 text-xs hover:underline">@{s.username}</a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/70">{PLAN_LABELS[s.plan] || s.plan}</td>
                    <td className="px-4 py-3 text-white">{s.amount_rub.toLocaleString("ru-RU")} ₽</td>
                    <td className="px-4 py-3 text-white/70">{formatDate(s.expires_at)}</td>
                    <td className="px-4 py-3">
                      {s.status === "active" ? (
                        <span className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs">Активна</span>
                      ) : (
                        <span className="px-2 py-1 rounded-lg bg-white/5 text-white/40 text-xs">Истекла</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminDriversTab;
