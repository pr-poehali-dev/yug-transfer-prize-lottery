import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import { fmtDate } from "./listTypes";
import { KNOWLEDGE_BASE_URL } from "../adminTypes";

interface Totals { total: number; searchers: number; black: number; white: number; unknown: number; today: number }
interface Top { key: string; name: string; username: string; tg_id: number | null; count: number; searchers: number; last_at: string; result: string }
interface Searcher { tg_id: number; username: string; name: string; count: number; last_at: string }
interface Recent { id: number; at: string; query: string; result: string; name: string; username: string; tg_id: number | null;
  searcher_id: number; searcher_username: string; searcher_name: string }

const RESULT: Record<string, { label: string; cls: string }> = {
  black: { label: "ЧС", cls: "bg-red-500/80 text-white" },
  white: { label: "Белый", cls: "bg-emerald-500/80 text-white" },
  unknown: { label: "Нет в базе", cls: "bg-amber-500 text-black" },
};

const PERIODS = [
  { d: 1, label: "Сутки" },
  { d: 7, label: "Неделя" },
  { d: 30, label: "Месяц" },
  { d: 365, label: "Год" },
];

function Badge({ r }: { r: string }) {
  const s = RESULT[r] || { label: r || "—", cls: "bg-white/15 text-white/70" };
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${s.cls}`}>{s.label}</span>;
}

function who(name: string, username: string, id?: number | null) {
  return (
    <div className="min-w-0">
      <div className="text-sm text-white truncate">{name || (username ? `@${username}` : id || "—")}</div>
      <div className="text-[11px] text-white/45 truncate">
        {username && <span className="text-sky-300">@{username}</span>}
        {username && id ? " · " : ""}
        {id ? <span className="font-mono">{id}</span> : null}
      </div>
    </div>
  );
}

export function SearchStatsPage({ token, onBack }: { token: string; onBack: () => void }) {
  const [days, setDays] = useState(30);
  const [tab, setTab] = useState<"top" | "recent" | "searchers">("top");
  const [data, setData] = useState<{ totals: Totals; top: Top[]; searchers: Searcher[]; recent: Recent[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${KNOWLEDGE_BASE_URL}?entity=searches&days=${days}`, { headers: { "X-Admin-Token": token } })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setData(d); else toast.error("Не удалось загрузить статистику"); })
      .catch(() => toast.error("Не удалось загрузить статистику"))
      .finally(() => setLoading(false));
  }, [days, token]);

  const t = data?.totals;
  const cards = t ? [
    { label: "Запросов", value: t.total, cls: "text-white" },
    { label: "За сутки", value: t.today, cls: "text-cyan-300" },
    { label: "Искали людей", value: t.searchers, cls: "text-violet-300" },
    { label: "Попали в ЧС", value: t.black, cls: "text-red-300" },
    { label: "Белый список", value: t.white, cls: "text-emerald-300" },
    { label: "Нет в базе", value: t.unknown, cls: "text-amber-300" },
  ] : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBack}
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm border border-white/10 text-white/70 hover:text-white hover:bg-white/5">
          <Icon name="ArrowLeft" size={14} />Назад
        </button>
        <Icon name="ChartColumn" fallback="BarChart3" size={18} className="text-orange-300" />
        <span className="text-base font-medium text-white">Статистика поиска</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button key={p.d} onClick={() => setDays(p.d)}
            className={`rounded-xl px-3 py-1.5 text-xs border transition-colors ${days === p.d
              ? "border-orange-400/60 bg-orange-500/15 text-orange-200" : "border-white/10 text-white/60 hover:bg-white/5"}`}>
            {p.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="text-sm text-white/50 py-10 text-center">Загрузка…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {cards.map((c) => (
              <div key={c.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <div className={`text-xl font-semibold ${c.cls}`}>{c.value}</div>
                <div className="text-[11px] text-white/45">{c.label}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-1 rounded-xl bg-white/[0.04] p-1 w-fit">
            {([["top", "Кого ищут"], ["recent", "Последние"], ["searchers", "Кто ищет"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`rounded-lg px-3 py-1.5 text-xs ${tab === k ? "bg-white/10 text-white" : "text-white/50 hover:text-white"}`}>
                {l}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/5">
            {tab === "top" && (data?.top.length ? data.top.map((r, i) => (
              <div key={r.key} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-6 text-xs text-white/35 text-right shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">{who(r.name, r.username || (r.name ? "" : r.key), r.tg_id)}</div>
                <Badge r={r.result} />
                <div className="text-right shrink-0 w-20">
                  <div className="text-sm font-semibold text-white">{r.count}×</div>
                  <div className="text-[10px] text-white/40">{r.searchers} чел.</div>
                </div>
              </div>
            )) : <Empty />)}

            {tab === "recent" && (data?.recent.length ? data.recent.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">
                    {r.name || (r.username ? `@${r.username}` : r.query)}
                    {r.name && r.username && <span className="text-sky-300 text-xs"> @{r.username}</span>}
                  </div>
                  <div className="text-[11px] text-white/45 truncate">
                    запрос «{r.query}» · искал {r.searcher_username ? `@${r.searcher_username}` : r.searcher_name || r.searcher_id}
                  </div>
                </div>
                <Badge r={r.result} />
                <span className="text-[10px] text-white/40 shrink-0 w-24 text-right">{fmtDate(r.at, true)}</span>
              </div>
            )) : <Empty />)}

            {tab === "searchers" && (data?.searchers.length ? data.searchers.map((r, i) => (
              <div key={r.tg_id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-6 text-xs text-white/35 text-right shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">{who(r.name, r.username, r.tg_id)}</div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold text-white">{r.count}</div>
                  <div className="text-[10px] text-white/40">{fmtDate(r.last_at, true)}</div>
                </div>
              </div>
            )) : <Empty />)}
          </div>
        </>
      )}
    </div>
  );
}

function Empty() {
  return <div className="text-sm text-white/45 py-8 text-center">Пока нет запросов — статистика начнёт собираться с новых поисков в боте</div>;
}

export default SearchStatsPage;
