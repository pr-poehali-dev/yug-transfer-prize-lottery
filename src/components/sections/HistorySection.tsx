import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import type { AppUser } from "@/pages/Index";
import { CABINET_URL, Entry, formatDate } from "./cabinet/cabinet-types";

interface HistorySectionProps {
  user: AppUser | null;
  onLogin: () => void;
}

type SortCol = "raffle_title" | "created_at" | "amount" | "tickets" | "raffle_status";

export function HistorySection({ user, onLogin }: HistorySectionProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortCol, setSortCol] = useState<SortCol>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetch(`${CABINET_URL}?entries`, { headers: { "X-User-Id": String(user.id) } })
      .then(r => r.json())
      .then(d => { if (d.ok) setEntries(d.entries || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const sorted = [...entries].sort((a, b) => {
    const av = a[sortCol];
    const bv = b[sortCol];
    if (typeof av === "string" && typeof bv === "string")
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const SortIcon = ({ col }: { col: SortCol }) => (
    <Icon
      name={sortCol === col ? (sortDir === "asc" ? "ChevronUp" : "ChevronDown") : "ChevronsUpDown"}
      size={14}
      className={sortCol === col ? "text-purple-400" : "text-muted-foreground"}
    />
  );

  if (!user) {
    return (
      <div className="text-center py-20">
        <div className="text-6xl mb-4">🔐</div>
        <p className="text-white font-semibold text-lg mb-2">Войди чтобы увидеть историю</p>
        <p className="text-muted-foreground mb-6 text-sm">История участий доступна только авторизованным пользователям</p>
        <button onClick={onLogin} className="grad-btn rounded-2xl px-8 py-3 font-bold flex items-center gap-2 mx-auto">
          <Icon name="LogIn" size={18} />
          Войти
        </button>
      </div>
    );
  }

  const totalSpent = entries.reduce((s, e) => s + e.amount, 0);
  const activeCount = entries.filter(e => e.raffle_status === "active").length;

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { label: "Всего участий", value: entries.length, suffix: "", icon: "List", grad: "from-purple-500 to-pink-500" },
          { label: "Потрачено", value: totalSpent.toLocaleString("ru"), suffix: " ₽", icon: "TrendingDown", grad: "from-orange-500 to-red-500" },
          { label: "Активных", value: activeCount, suffix: "", icon: "Activity", grad: "from-cyan-500 to-blue-500" },
        ].map((s, i) => (
          <div key={s.label} className="glass rounded-2xl p-5 flex items-center gap-4 animate-fade-in-up"
            style={{ animationDelay: `${i * 0.1}s`, animationFillMode: "forwards" }}>
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${s.grad} flex items-center justify-center shrink-0`}>
              <Icon name={s.icon as string} size={20} className="text-white" fallback="Star" />
            </div>
            <div>
              <p className="font-oswald text-2xl font-bold text-white">{s.value}{s.suffix}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card-glow rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🎫</div>
            <p className="text-white font-semibold mb-1">Участий пока нет</p>
            <p className="text-muted-foreground text-sm">Купи билет на розыгрыш — история появится здесь</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {([
                    { col: "raffle_title" as SortCol, label: "Розыгрыш" },
                    { col: "created_at" as SortCol, label: "Дата" },
                    { col: "amount" as SortCol, label: "Сумма" },
                    { col: "tickets" as SortCol, label: "Билетов" },
                    { col: "raffle_status" as SortCol, label: "Статус" },
                  ]).map(({ col, label }) => (
                    <th key={col} onClick={() => handleSort(col)}
                      className="px-5 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-white transition-colors">
                      <div className="flex items-center gap-1.5">
                        {label}
                        <SortIcon col={col} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((e, i) => (
                  <tr key={e.id} className="border-b border-white/5 hover:bg-white/3 transition-colors animate-fade-in-up"
                    style={{ animationDelay: `${i * 0.04}s`, animationFillMode: "forwards" }}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-white/5 flex items-center justify-center">
                          {e.raffle_photo
                            ? <img src={e.raffle_photo} alt={e.raffle_title} className="w-full h-full object-cover" />
                            : <span className="text-lg">{e.raffle_icon || "🎁"}</span>
                          }
                        </div>
                        <span className="text-sm text-white font-medium">{e.raffle_title}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-muted-foreground whitespace-nowrap">{formatDate(e.created_at)}</td>
                    <td className="px-5 py-4 text-sm font-bold text-white">{e.amount.toLocaleString("ru")} ₽</td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">{e.tickets} шт.</td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                        e.raffle_status === "active"
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : "bg-slate-500/20 text-slate-400 border-slate-500/30"
                      }`}>
                        {e.raffle_status === "active" ? "Активен" : "Завершён"}
                      </span>
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
