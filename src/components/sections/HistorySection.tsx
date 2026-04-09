import { useState } from "react";
import Icon from "@/components/ui/icon";
import { HISTORY } from "@/components/raffle-types";

export function HistorySection() {
  const [sortCol, setSortCol] = useState<string>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  type HistoryItem = typeof HISTORY[0];
  const sorted = [...HISTORY].sort((a: HistoryItem, b: HistoryItem) => {
    const av = a[sortCol as keyof HistoryItem];
    const bv = b[sortCol as keyof HistoryItem];
    if (typeof av === "string" && typeof bv === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const SortIcon = ({ col }: { col: string }) => (
    <Icon
      name={sortCol === col ? (sortDir === "asc" ? "ChevronUp" : "ChevronDown") : "ChevronsUpDown"}
      size={14}
      className={sortCol === col ? "text-purple-400" : "text-muted-foreground"}
    />
  );

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { label: "Всего участий", value: HISTORY.length, suffix: "", icon: "List", grad: "from-purple-500 to-pink-500" },
          { label: "Потрачено", value: HISTORY.reduce((s, h) => s + h.amount, 0).toLocaleString("ru"), suffix: " ₽", icon: "TrendingDown", grad: "from-orange-500 to-red-500" },
          { label: "Активных", value: HISTORY.filter(h => h.status === "Участвую").length, suffix: "", icon: "Activity", grad: "from-cyan-500 to-blue-500" },
        ].map((s, i) => (
          <div
            key={s.label}
            className="glass rounded-2xl p-5 flex items-center gap-4 opacity-0-init animate-fade-in-up"
            style={{ animationDelay: `${i * 0.1}s`, animationFillMode: "forwards" }}
          >
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
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {[
                  { col: "raffle", label: "Розыгрыш" },
                  { col: "date", label: "Дата" },
                  { col: "amount", label: "Сумма" },
                  { col: "tickets", label: "Билетов" },
                  { col: "status", label: "Статус" },
                ].map(({ col, label }) => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className="px-5 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      {label}
                      <SortIcon col={col} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((item, i) => (
                <tr
                  key={item.id}
                  className="border-b border-white/5 hover:bg-white/3 transition-colors opacity-0-init animate-fade-in-up"
                  style={{ animationDelay: `${i * 0.05}s`, animationFillMode: "forwards" }}
                >
                  <td className="px-5 py-4 text-sm text-white font-medium">{item.raffle}</td>
                  <td className="px-5 py-4 text-sm text-muted-foreground">{item.date}</td>
                  <td className="px-5 py-4 text-sm font-bold text-white">{item.amount.toLocaleString("ru")} ₽</td>
                  <td className="px-5 py-4 text-sm text-muted-foreground">{item.tickets} шт.</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                      item.status === "Участвую"
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : "bg-slate-500/20 text-slate-400 border-slate-500/30"
                    }`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
