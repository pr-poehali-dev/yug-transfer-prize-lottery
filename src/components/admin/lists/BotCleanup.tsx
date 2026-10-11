import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import { KNOWLEDGE_BASE_URL } from "../adminTypes";

interface Data {
  count: number;
  banned: number;
  groups: { title: string; count: number }[];
  sample: { id: number; name: string; tg_id: number; groups: string[] }[];
}

const API = `${KNOWLEDGE_BASE_URL}?entity=bots`;

export function BotCleanup({ token, onChanged }: { token: string; onChanged: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [group, setGroup] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async (g = group) => {
    const d = await fetch(`${API}&group=${encodeURIComponent(g)}`, { headers: { "X-Admin-Token": token } })
      .then((r) => r.json()).catch(() => null);
    if (d?.ok) setData(d);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const remove = async (ids?: number[]) => {
    const n = ids ? ids.length : data?.count || 0;
    if (!n) return;
    if (!confirm(`Удалить навсегда ${n} подозрительных аккаунтов? Они попадут в бан-лист и больше не добавятся при сканировании групп.`)) return;
    setBusy(true);
    const q = ids ? `&ids=${ids.join(",")}` : `&group=${encodeURIComponent(group)}`;
    const d = await fetch(`${API}${q}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Token": token }, body: "{}" })
      .then((r) => r.json()).catch(() => null);
    setBusy(false);
    if (d?.ok) {
      toast.success(`Удалено навсегда: ${d.deleted}`);
      onChanged();
      load();
    } else toast.error("Не удалось удалить");
  };

  if (!data || (!data.count && !group)) return null;

  return (
    <div className="rounded-xl border border-orange-400/30 bg-orange-500/[0.05] p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Icon name="Bot" size={16} className="text-orange-300" />
        <span className="text-sm text-white">
          Похоже на ботов: <b>{data.count}</b>
        </span>
        <span className="text-[11px] text-white/40">нет @ника, фото, телефона и описания · в бан-листе {data.banned}</span>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setOpen((v) => !v)}
            className="rounded-lg px-3 py-1.5 text-xs border border-white/10 text-white/70 hover:bg-white/5 flex items-center gap-1">
            <Icon name={open ? "ChevronUp" : "Eye"} size={12} />{open ? "Скрыть" : "Посмотреть"}
          </button>
          <button onClick={() => remove()} disabled={busy || !data.count}
            className="rounded-lg px-3 py-1.5 text-xs bg-red-500/80 hover:bg-red-500 text-white flex items-center gap-1 disabled:opacity-50">
            <Icon name={busy ? "Loader2" : "Trash2"} size={12} className={busy ? "animate-spin" : ""} />
            Удалить навсегда ({data.count})
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-2 pt-1">
          <div className="flex flex-wrap gap-1">
            <button onClick={() => { setGroup(""); load(""); }}
              className={`rounded-full px-2.5 py-1 text-[11px] border ${!group ? "border-orange-400/60 bg-orange-500/15 text-white" : "border-white/10 text-white/60"}`}>
              Все группы
            </button>
            {data.groups.map((g) => (
              <button key={g.title} onClick={() => { setGroup(g.title); load(g.title); }}
                className={`rounded-full px-2.5 py-1 text-[11px] border ${group === g.title ? "border-orange-400/60 bg-orange-500/15 text-white" : "border-white/10 text-white/60"}`}>
                {g.title} · {g.count}
              </button>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-72 overflow-y-auto">
            {data.sample.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2 py-1.5 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="text-white truncate">{s.name || "Без имени"}</div>
                  <div className="text-white/40 font-mono text-[10px]">ID {s.tg_id}</div>
                </div>
                <button onClick={() => remove([s.id])} title="Удалить навсегда" className="p-1 text-white/40 hover:text-red-400">
                  <Icon name="X" size={12} />
                </button>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-white/40">
            Показаны первые 60. Реальные люди без ника и фото тоже сюда попадут — пролистайте перед удалением.
            Карточки с жалобами и из белого/чёрного списков не трогаем.
          </div>
        </div>
      )}
    </div>
  );
}

export default BotCleanup;
