import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import { COMPLAINTS_API, COMPLAINT_TO_GROUP_API, fmtDate } from "./listTypes";

interface Complaint {
  id: number;
  item_id: number | null;
  reporter_tg_id: number;
  reporter_username: string;
  reporter_name: string;
  text: string;
  incident_date: string | null;
  photos: string[];
  status: "new" | "accepted" | "rejected";
  group_msg_id?: number | null;
  admin_note: string;
  created_at: string;
  target: { name: string; username: string; role: string; list_type: string; photo_url: string; tg_id: number | null };
  stats: { total: number; accepted: number; reporters: number };
}

const STATUS: Record<string, { label: string; cls: string }> = {
  new: { label: "Новая", cls: "bg-amber-500 text-black" },
  accepted: { label: "Принята", cls: "bg-red-500/80 text-white" },
  rejected: { label: "Не обоснована", cls: "bg-white/15 text-white/70" },
};
const ROLE: Record<string, string> = { driver: "Водитель", dispatcher: "Диспетчер" };
const LIST: Record<string, string> = { white: "белый список", black: "чёрный список", pending: "на модерации" };

export function ComplaintsPage({ token, onBack }: { token: string; onBack: () => void }) {
  const [items, setItems] = useState<Complaint[]>([]);
  const [filter, setFilter] = useState<"new" | "accepted" | "rejected" | "">("new");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [itemFilter, setItemFilter] = useState<{ id: number; name: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const qs = `${filter ? `&status=${filter}` : ""}${itemFilter ? `&item=${itemFilter.id}` : ""}`;
      const res = await fetch(`${COMPLAINTS_API}${qs}`, { headers: { "X-Admin-Token": token } });
      const d = await res.json();
      if (d.ok) setItems(d.items || []);
    } catch {
      toast.error("Не удалось загрузить жалобы");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, token, itemFilter]);

  const [sending, setSending] = useState<number | null>(null);

  const sendToGroup = async (c: Complaint) => {
    setSending(c.id);
    try {
      const res = await fetch(`${COMPLAINT_TO_GROUP_API}&id=${c.id}`);
      const d = await res.json();
      if (d.ok) toast.success(`Жалоба отправлена в ${d.where}`, { description: "Решение примут администраторы группы" });
      else toast.error(d.error || "Не удалось отправить");
      load();
    } catch {
      toast.error("Не удалось отправить");
    }
    setSending(null);
  };

  const decide = async (c: Complaint, status: "accepted" | "rejected", toBlack = false) => {
    setBusy(c.id);
    try {
      const res = await fetch(COMPLAINTS_API, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify({ id: c.id, status, to_black: toBlack }),
      });
      const d = await res.json();
      if (d.ok) {
        toast.success(toBlack ? "Занесён в ЧС, автору отправлено уведомление" : status === "accepted" ? "Жалоба принята" : "Жалоба не обоснована, автору отправлено уведомление");
        load();
      } else toast.error("Не удалось сохранить");
    } catch {
      toast.error("Не удалось сохранить");
    }
    setBusy(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBack}
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm border border-white/10 text-white/70 hover:text-white hover:bg-white/5">
          <Icon name="ArrowLeft" size={14} />Назад
        </button>
        <Icon name="ShieldAlert" size={18} className="text-red-400" />
        <span className="text-base font-medium text-white">Жалобы</span>
        <span className="text-xs text-white/40">· {items.length}</span>
      </div>

      <div className="flex gap-1 overflow-x-auto">
        {([["new", "Новые"], ["accepted", "Принятые"], ["rejected", "Не обоснованные"], ["", "Все"]] as const).map(([k, l]) => (
          <button key={k || "all"} onClick={() => setFilter(k)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs border ${filter === k
              ? "border-red-400/60 bg-red-500/15 text-red-200" : "border-white/10 text-white/60 hover:bg-white/5"}`}>
            {l}
          </button>
        ))}
      </div>

      {itemFilter && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/[0.06] px-3 py-2 text-xs text-white/80">
          <Icon name="Filter" size={12} className="text-red-300" />
          Все жалобы на: <b className="text-white">{itemFilter.name}</b>
          <button onClick={() => setItemFilter(null)} className="ml-auto text-white/50 hover:text-white flex items-center gap-1">
            <Icon name="X" size={12} />Сбросить
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-white/40"><Icon name="Loader2" size={20} className="animate-spin inline" /></div>
      ) : !items.length ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] py-10 text-center text-sm text-white/40">Жалоб нет</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {items.map((c) => (
            <div key={c.id} className="rounded-xl border border-white/10 bg-[#14141c] p-3 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-lg bg-white/5 overflow-hidden shrink-0 flex items-center justify-center">
                  {c.target.photo_url
                    ? <img src={c.target.photo_url} alt="" className="w-full h-full object-cover" />
                    : <Icon name="User" size={18} className="text-white/30" />}
                </div>
                <div className="flex-1 min-w-0 text-xs space-y-0.5">
                  <div className="text-sm font-semibold text-white truncate">На: {c.target.name || "Без имени"}</div>
                  <div className="text-white/50 truncate">
                    {c.target.username ? `@${c.target.username} · ` : ""}{c.target.tg_id ? `ID ${c.target.tg_id}` : ""}
                  </div>
                  <div className={c.target.list_type === "black" ? "text-red-300" : "text-white/40"}>
                    {ROLE[c.target.role] || "Роль не указана"} · {LIST[c.target.list_type] || "—"}
                  </div>
                  {c.item_id && c.stats.total > 0 && (
                    <button
                      onClick={() => { setItemFilter({ id: c.item_id as number, name: c.target.name || `@${c.target.username}` }); setFilter(""); }}
                      className={`mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                        c.stats.total > 1 ? "bg-red-500/20 text-red-200 hover:bg-red-500/30" : "bg-white/10 text-white/60 hover:bg-white/15"
                      }`}
                      title="Показать все жалобы на этот аккаунт"
                    >
                      <Icon name="Megaphone" fallback="AlertTriangle" size={10} />
                      Жалоб: {c.stats.total} · принято {c.stats.accepted} · от {c.stats.reporters} чел.
                    </button>
                  )}
                </div>
                <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS[c.status].cls}`}>
                  {STATUS[c.status].label}
                </span>
              </div>

              <div className="rounded-lg bg-white/[0.03] border border-white/5 p-2.5 space-y-1.5">
                <div className="text-sm text-white whitespace-pre-wrap break-words">{c.text || "—"}</div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/50">
                  <span className="flex items-center gap-1"><Icon name="Calendar" size={11} />Когда: {c.incident_date ? fmtDate(c.incident_date) : "—"}</span>
                  <span className="flex items-center gap-1"><Icon name="Clock" size={11} />Подана: {fmtDate(c.created_at, true)}</span>
                </div>
              </div>

              {c.photos.length > 0 && (
                <div className="flex gap-2 overflow-x-auto">
                  {c.photos.map((p) => (
                    <button key={p} onClick={() => setPreview(p)} className="w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-white/10">
                      <img src={p} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1.5 text-[11px] text-white/60">
                <Icon name="UserRound" fallback="User" size={12} />
                Пожаловался:
                <a href={c.reporter_username ? `https://t.me/${c.reporter_username}` : `tg://user?id=${c.reporter_tg_id}`}
                  target="_blank" rel="noreferrer" className="text-sky-300 hover:underline truncate">
                  {c.reporter_name || "—"}{c.reporter_username ? ` @${c.reporter_username}` : ""}
                </a>
                <span className="text-white/30 font-mono">ID {c.reporter_tg_id}</span>
              </div>

              {c.status === "new" && (
                <button disabled={sending === c.id} onClick={() => sendToGroup(c)}
                  className="w-full rounded-lg border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 text-sky-200 text-xs py-2 flex items-center justify-center gap-1.5 disabled:opacity-60">
                  <Icon name={sending === c.id ? "Loader2" : "Send"} size={13} className={sending === c.id ? "animate-spin" : ""} />
                  {c.group_msg_id ? "Отправить в группу ЧС повторно" : "Отправить в группу ЧС на решение"}
                </button>
              )}

              {c.status === "new" && (
                <div className="grid grid-cols-3 gap-1.5">
                  <button disabled={busy === c.id} onClick={() => decide(c, "accepted", true)}
                    className="rounded-lg bg-red-500/80 hover:bg-red-500 text-white text-[11px] py-2 disabled:opacity-60">
                    Заносим в ЧС
                  </button>
                  <button disabled={busy === c.id} onClick={() => decide(c, "accepted")}
                    className="rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[11px] py-2 disabled:opacity-60">
                    Принять
                  </button>
                  <button disabled={busy === c.id} onClick={() => decide(c, "rejected")}
                    className="rounded-lg border border-white/10 hover:bg-white/5 text-white/70 text-[11px] py-2 disabled:opacity-60">
                    Не обоснована
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <img src={preview} alt="" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}
    </div>
  );
}

export default ComplaintsPage;
