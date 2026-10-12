import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import { fmtDate } from "./listTypes";
import { KNOWLEDGE_BASE_URL } from "../adminTypes";
import { TgLink } from "./TgLink";

interface Change {
  item_id: number; field: string; label: string; old: string; new: string; changed_at: string;
  name: string; username: string; photo_url: string; role: string; list_type: string;
}
interface Missing { id: number; name: string; username: string; photo_url: string; role: string; list_type: string; status: string; at: string }
interface Summary {
  total: number; scanned: number; left: number; recent: number;
  by_field: Record<string, number>; gone: Record<string, number>; changes: Change[]; missing: Missing[];
}

const PERIODS = [{ d: 1, label: "Сутки" }, { d: 7, label: "Неделя" }, { d: 30, label: "Месяц" }];
const FIELDS = [
  { key: "", label: "Все", icon: "List" },
  { key: "username", label: "Ник", icon: "AtSign" },
  { key: "name", label: "Имя", icon: "User" },
  { key: "photo_url", label: "Фото", icon: "Image" },
  { key: "bio", label: "Описание", icon: "FileText" },
];

function Avatar({ url, name }: { url: string; name: string }) {
  return url ? (
    <img src={url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
  ) : (
    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-sm text-white/60 shrink-0">
      {(name || "?").slice(0, 1).toUpperCase()}
    </div>
  );
}

function listTag(role: string, lt: string) {
  const r = role === "driver" ? "водитель" : role === "dispatcher" ? "диспетчер" : "";
  const black = lt === "black";
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${black ? "bg-red-500/80 text-white" : "bg-emerald-500/20 text-emerald-300"}`}>
      {black ? "ЧС" : "белый"}{r ? ` · ${r}` : ""}
    </span>
  );
}

function Value({ field, v }: { field: string; v: string }) {
  if (field === "photo_url") return v ? <img src={v} alt="" className="w-8 h-8 rounded-full object-cover inline-block" /> : <span className="text-white/30">нет</span>;
  if (!v) return <span className="text-white/30">пусто</span>;
  return <span className="break-all">{field === "username" ? `@${v}` : v}</span>;
}

export function ScanSummaryPage({ token, onBack }: { token: string; onBack: () => void }) {
  const [days, setDays] = useState(7);
  const [field, setField] = useState("");
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${KNOWLEDGE_BASE_URL}?entity=scan_summary&days=${days}&field=${field}`, { headers: { "X-Admin-Token": token } })
      .then((r) => r.json())
      .then((d) => (d.ok ? setData(d) : toast.error("Не удалось загрузить сводку")))
      .catch(() => toast.error("Не удалось загрузить сводку"))
      .finally(() => setLoading(false));
  }, [token, days, field]);

  const pct = data ? Math.round((data.scanned / Math.max(1, data.total)) * 100) : 0;
  const goneTotal = data ? Object.values(data.gone).reduce((a, b) => a + b, 0) : 0;
  const stats = data
    ? [
        { label: "Проверено", value: `${data.scanned}`, sub: `из ${data.total} · ${pct}%`, icon: "CheckCheck", cls: "text-cyan-300" },
        { label: "Осталось", value: `${data.left}`, sub: "ещё не проверены", icon: "Hourglass", cls: "text-amber-300" },
        { label: "Сменили ник", value: `${data.by_field.username || 0}`, sub: "за период", icon: "AtSign", cls: "text-violet-300" },
        { label: "Сменили фото", value: `${data.by_field.photo_url || 0}`, sub: "за период", icon: "Image", cls: "text-sky-300" },
        { label: "Сменили имя", value: `${data.by_field.name || 0}`, sub: "за период", icon: "User", cls: "text-emerald-300" },
        { label: "Удалены / скрыты", value: `${goneTotal}`, sub: "аккаунт не найден", icon: "UserX", cls: "text-red-300" },
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBack}
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm border border-white/10 text-white/70 hover:text-white hover:bg-white/5">
          <Icon name="ArrowLeft" size={14} />Назад
        </button>
        <Icon name="ClipboardList" size={18} className="text-cyan-300" />
        <span className="text-base font-medium text-white">Сводка сканирования</span>
      </div>

      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <button key={p.d} onClick={() => setDays(p.d)}
            className={`rounded-xl px-3 py-1.5 text-sm border ${days === p.d ? "border-cyan-400/60 bg-cyan-500/15 text-white" : "border-white/10 text-white/60 hover:text-white"}`}>
            {p.label}
          </button>
        ))}
      </div>

      {!data ? (
        <div className="text-sm text-white/50 py-10 text-center">{loading ? "Загрузка…" : "Нет данных"}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <Icon name={s.icon} fallback="Circle" size={14} className={s.cls} />{s.label}
                </div>
                <div className="text-2xl font-semibold text-white mt-1">{s.value}</div>
                <div className="text-xs text-white/40">{s.sub}</div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-white mr-2">Что изменилось</span>
              {FIELDS.map((f) => (
                <button key={f.key} onClick={() => setField(f.key)}
                  className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs border ${field === f.key ? "border-cyan-400/60 bg-cyan-500/15 text-white" : "border-white/10 text-white/60 hover:text-white"}`}>
                  <Icon name={f.icon} fallback="Circle" size={12} />{f.label}
                </button>
              ))}
            </div>
            {data.changes.length === 0 ? (
              <div className="text-sm text-white/40 py-6 text-center">За этот период изменений не найдено</div>
            ) : (
              <div className="divide-y divide-white/5">
                {data.changes.map((c, i) => (
                  <div key={i} className="py-3 flex gap-3">
                    <Avatar url={c.photo_url} name={c.name || c.username} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-white truncate">{c.name || "Без имени"}</span>
                        {c.username && <TgLink username={c.username} className="text-xs text-sky-300" />}
                        {listTag(c.role, c.list_type)}
                      </div>
                      <div className="text-xs text-white/70 flex flex-wrap items-center gap-1.5">
                        <span className="text-white/40">{c.label}:</span>
                        <span className="line-through text-white/40"><Value field={c.field} v={c.old} /></span>
                        <Icon name="ArrowRight" size={12} className="text-cyan-300" />
                        <Value field={c.field} v={c.new} />
                      </div>
                      <div className="text-[11px] text-white/30">{fmtDate(c.changed_at, true)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-red-400/20 bg-red-500/[0.04] p-4 space-y-3">
            <div className="text-sm font-medium text-white flex items-center gap-2">
              <Icon name="UserX" size={16} className="text-red-300" />Удалили аккаунт или скрылись
              <span className="text-xs text-white/40">· {goneTotal}</span>
            </div>
            {data.missing.length === 0 ? (
              <div className="text-sm text-white/40 py-4 text-center">Таких нет</div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2">
                {data.missing.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-2">
                    <Avatar url={m.photo_url} name={m.name || m.username} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-white truncate">{m.name || (m.username ? `@${m.username}` : "Без имени")}</div>
                      <div className="text-[11px] text-white/40 truncate">{m.status}{m.at ? ` · ${fmtDate(m.at)}` : ""}</div>
                    </div>
                    {listTag(m.role, m.list_type)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default ScanSummaryPage;
