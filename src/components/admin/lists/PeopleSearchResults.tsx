import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { LISTS, LISTS_API, type ListDef, type ListItem } from "./listTypes";
import { PersonEditDialog } from "./PersonEditDialog";

const PENDING_DEF: ListDef = { role: "", list_type: "pending", title: "На модерации", icon: "Clock", color: "text-amber-400" };

function defOf(i: ListItem): ListDef {
  return LISTS.find((d) => d.role === i.role && d.list_type === i.list_type) || PENDING_DEF;
}

function badge(i: ListItem) {
  if (i.list_type === "pending") return { text: "На модерации", cls: "bg-amber-500/15 text-amber-300" };
  const who = i.role === "driver" ? "водитель" : "диспетчер";
  return i.list_type === "black"
    ? { text: `Чёрный · ${who}`, cls: "bg-red-500/15 text-red-300" }
    : { text: `Белый · ${who}`, cls: "bg-emerald-500/15 text-emerald-300" };
}

export function PeopleSearchResults({ token, query, onChanged }: { token: string; query: string; onChanged?: () => void }) {
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [openItem, setOpenItem] = useState<ListItem | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setItems([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${LISTS_API}&search=1&q=${encodeURIComponent(q)}`, { headers: { "X-Admin-Token": token } });
        const d = await r.json();
        setItems(d.ok ? d.items || [] : []);
      } catch {
        setItems([]);
      }
      setLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [query, token, reload]);

  if (query.trim().length < 2) return null;

  return (
    <div className="space-y-2">
      <div className="text-xs text-white/50 flex items-center gap-1.5">
        <Icon name="Users" size={13} />Люди в базе
        {loading && <Icon name="Loader2" size={12} className="animate-spin" />}
        {!loading && <span>· {items.length}{items.length >= 30 ? "+" : ""}</span>}
      </div>
      {!loading && !items.length ? (
        <div className="rounded-xl border border-white/10 space-card py-4 text-center text-sm text-white/40">Никого не нашли</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {items.map((i) => {
            const b = badge(i);
            return (
              <button key={i.id} onClick={() => setOpenItem(i)}
                className="rounded-xl border border-white/10 space-card p-2.5 flex items-center gap-3 text-left hover:border-white/25 transition-colors">
                <div className="w-11 h-11 rounded-lg bg-white/5 overflow-hidden shrink-0 flex items-center justify-center">
                  {i.photo_url
                    ? <img src={i.photo_url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-xs text-white/40">{(i.name || i.username || "?").slice(0, 2).toUpperCase()}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white truncate">{i.name || "Без имени"}</div>
                  <div className="text-[11px] text-white/50 truncate">
                    {i.username ? `@${i.username}` : ""}{i.username && i.tg_id ? " · " : ""}{i.tg_id ? `ID ${i.tg_id}` : ""}
                    {!i.username && !i.tg_id && i.phone ? i.phone : ""}
                  </div>
                  <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full ${b.cls}`}>{b.text}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {openItem && (
        <PersonEditDialog
          token={token}
          def={defOf(openItem)}
          item={openItem}
          open={!!openItem}
          onClose={() => setOpenItem(null)}
          onSaved={() => { setReload((x) => x + 1); onChanged?.(); }}
        />
      )}
    </div>
  );
}

export default PeopleSearchResults;
