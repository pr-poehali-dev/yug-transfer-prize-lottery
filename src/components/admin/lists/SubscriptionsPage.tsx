import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/icon";
import { KNOWLEDGE_BASE_URL } from "../adminTypes";
import { fmtDate, inputCls } from "./listTypes";

interface Payment {
  id: number;
  tg_id: number | null;
  username: string;
  name: string;
  amount: number;
  note: string;
  created_at: string;
  active_until: string | null;
}

interface Subscriber {
  tg_id: number;
  username: string;
  name: string;
  active_until: string | null;
  is_trial?: boolean;
  created_at?: string;
}

interface Data {
  month: string;
  stats: {
    month_count: number;
    month_sum: number;
    month_users: number;
    all_count: number;
    all_sum: number;
    active: number;
    total_subs: number;
    expiring: number;
    trial_active?: number;
    new_today?: number;
  };
  by_month: { month: string; count: number; sum: number }[];
  payments: Payment[];
  subscribers: Subscriber[];
}

const rub = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`;
const monthName = (m: string) => {
  const [y, mm] = m.split("-").map(Number);
  return new Date(y, mm - 1, 1).toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
};
const shiftMonth = (m: string, delta: number) => {
  const [y, mm] = m.split("-").map(Number);
  const d = new Date(y, mm - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

function Stat({ icon, label, value, hint, color }: { icon: string; label: string; value: string; hint?: string; color: string }) {
  return (
    <div className="rounded-2xl border border-white/10 space-card p-4">
      <div className="flex items-center gap-2 text-xs text-white/50">
        <Icon name={icon} size={14} className={color} />{label}
      </div>
      <div className="text-xl md:text-2xl font-semibold text-white mt-1.5">{value}</div>
      {hint && <div className="text-[11px] text-white/40 mt-0.5">{hint}</div>}
    </div>
  );
}

export function SubscriptionsPage({ token, onBack }: { token: string; onBack: () => void }) {
  const [month, setMonth] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"payments" | "subscribers">("payments");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`${KNOWLEDGE_BASE_URL}?entity=subs${month ? `&month=${month}` : ""}`, { headers: { "X-Admin-Token": token } })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setData(d);
          if (!month) setMonth(d.month);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [month, token]);

  const maxSum = Math.max(1, ...(data?.by_month || []).map((m) => m.sum));
  const now = Date.now();

  const subs = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^@/, "");
    const list = data?.subscribers || [];
    if (!q) return list;
    return list.filter((s) => [s.name, s.username, String(s.tg_id)].some((v) => v.toLowerCase().includes(q)));
  }, [data, search]);

  const pays = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^@/, "");
    const list = data?.payments || [];
    if (!q) return list;
    return list.filter((p) => [p.name, p.username, String(p.tg_id ?? "")].some((v) => v.toLowerCase().includes(q)));
  }, [data, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBack}
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm border border-white/10 text-white/70 hover:text-white hover:bg-white/5">
          <Icon name="ArrowLeft" size={14} />Назад
        </button>
        <Icon name="CreditCard" size={18} className="text-violet-400" />
        <span className="text-base font-medium text-white">Подписки</span>
        {month && (
          <div className="ml-auto flex items-center gap-1 rounded-xl border border-white/10 p-1">
            <button onClick={() => setMonth(shiftMonth(month, -1))} className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5">
              <Icon name="ChevronLeft" size={15} />
            </button>
            <span className="text-sm text-white capitalize px-2 min-w-[130px] text-center">{monthName(month)}</span>
            <button onClick={() => setMonth(shiftMonth(month, 1))} className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5">
              <Icon name="ChevronRight" size={15} />
            </button>
          </div>
        )}
      </div>

      {loading && !data ? (
        <div className="text-sm text-white/50 py-10 text-center">Загрузка…</div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Stat icon="Wallet" color="text-emerald-400" label="Доход за месяц" value={rub(data.stats.month_sum)}
              hint={`${data.stats.month_count} оплат`} />
            <Stat icon="UserCheck" color="text-sky-400" label="Оплатили в месяце" value={String(data.stats.month_users)}
              hint="человек" />
            <Stat icon="BadgeCheck" color="text-violet-400" label="Активных подписок" value={String(data.stats.active)}
              hint={`из них на тесте: ${data.stats.trial_active ?? 0}`} />
            <Stat icon="UserPlus" color="text-sky-400" label="Запустили бота" value={String(data.stats.total_subs)}
              hint={`за сутки: ${data.stats.new_today ?? 0}`} />
            <Stat icon="TrendingUp" color="text-amber-400" label="Доход за всё время" value={rub(data.stats.all_sum)}
              hint={`${data.stats.all_count} оплат`} />
          </div>

          <div className="rounded-2xl border border-white/10 space-card p-4">
            <div className="text-xs text-white/50 mb-3">Доход по месяцам</div>
            {data.by_month.length === 0 ? (
              <div className="text-sm text-white/40 py-4 text-center">Оплат за последний год нет</div>
            ) : (
              <div className="flex items-end gap-2 h-36">
                {data.by_month.map((m) => (
                  <button key={m.month} onClick={() => setMonth(m.month)} className="flex-1 flex flex-col items-center gap-1 group min-w-0">
                    <span className="text-[10px] text-white/50 truncate">{rub(m.sum)}</span>
                    <div
                      className={`w-full rounded-t-md transition-colors ${m.month === month ? "bg-violet-500" : "bg-violet-500/35 group-hover:bg-violet-500/60"}`}
                      style={{ height: `${Math.max(6, (m.sum / maxSum) * 96)}px` }}
                    />
                    <span className="text-[10px] text-white/40">{m.month.slice(5)}.{m.month.slice(2, 4)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex rounded-xl border border-white/10 p-1">
              {([["payments", "Кто оплатил"], ["subscribers", "Все подписчики"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)}
                  className={`px-3 py-1.5 rounded-lg text-sm ${tab === k ? "bg-white/10 text-white" : "text-white/50 hover:text-white"}`}>
                  {l}
                </button>
              ))}
            </div>
            <div className="relative flex-1">
              <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск: имя, @username, ID"
                className={`${inputCls} pl-9`} />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 overflow-hidden">
            {tab === "payments" ? (
              pays.length === 0 ? (
                <div className="text-sm text-white/40 py-8 text-center">В этом месяце оплат нет</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {pays.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-9 h-9 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                        <Icon name="Check" size={16} className="text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">
                          {p.name || "Без имени"} {p.username && <span className="text-sky-300">@{p.username}</span>}
                        </div>
                        <div className="text-[11px] text-white/40">
                          {fmtDate(p.created_at, true)}{p.tg_id ? ` · ID ${p.tg_id}` : ""}{p.note ? ` · ${p.note}` : ""}
                        </div>
                      </div>
                      <div className="text-sm font-medium text-emerald-300 shrink-0">{rub(p.amount)}</div>
                    </div>
                  ))}
                </div>
              )
            ) : subs.length === 0 ? (
              <div className="text-sm text-white/40 py-8 text-center">Подписчиков нет</div>
            ) : (
              <div className="divide-y divide-white/5">
                {subs.map((s) => {
                  const active = s.active_until && new Date(s.active_until).getTime() > now;
                  return (
                    <div key={s.tg_id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">
                          {s.name || "Без имени"} {s.username && <span className="text-sky-300">@{s.username}</span>}
                        </div>
                        <div className="text-[11px] text-white/40">
                          ID {s.tg_id}{s.created_at ? ` · запустил бота ${fmtDate(s.created_at)}` : ""}
                        </div>
                      </div>
                      {s.is_trial && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full shrink-0 bg-sky-500/15 text-sky-300">🎁 Тест</span>
                      )}
                      <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${active ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-white/50"}`}>
                        {active ? `до ${fmtDate(s.active_until)}` : s.active_until ? `истекла ${fmtDate(s.active_until)}` : "нет"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="text-sm text-white/50 py-10 text-center">Не удалось загрузить данные</div>
      )}
    </div>
  );
}

export default SubscriptionsPage;
