import { useState } from "react";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import { LISTS, LISTS_API, ListItem } from "./listTypes";

interface Props {
  token: string;
  items: ListItem[];
  onChanged: () => void;
  onOpen: (item: ListItem) => void;
}

const SHORT: Record<string, string> = {
  "dispatcher-white": "Белый · диспетчер",
  "dispatcher-black": "Чёрный · диспетчер",
  "driver-white": "Белый · водитель",
  "driver-black": "Чёрный · водитель",
};

export function ModerationStrip({ token, items, onChanged, onOpen }: Props) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [menuId, setMenuId] = useState<number | null>(null);

  if (!items.length) return null;

  const assign = async (item: ListItem, role: string, list_type: string) => {
    setBusyId(item.id);
    setMenuId(null);
    try {
      const res = await fetch(LISTS_API, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify({
          id: item.id, role, list_type, name: item.name, username: item.username, phone: item.phone,
          tg_id: item.tg_id, note: item.note, reason: item.reason, removed_at: item.removed_at, photo_url: item.photo_url,
        }),
      });
      const d = await res.json();
      if (d.ok) {
        toast.success(`Перемещено: ${LISTS.find((l) => l.role === role && l.list_type === list_type)?.title}`);
        onChanged();
      } else toast.error("Не удалось присвоить статус");
    } catch {
      toast.error("Не удалось присвоить статус");
    }
    setBusyId(null);
  };

  const remove = (item: ListItem) => {
    toast("Удалить карточку с модерации?", {
      action: {
        label: "Удалить",
        onClick: async () => {
          await fetch(`${LISTS_API}&id=${item.id}`, { method: "DELETE", headers: { "X-Admin-Token": token } });
          onChanged();
        },
      },
      cancel: { label: "Отмена", onClick: () => {} },
    });
  };

  return (
    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.04]">
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <Icon name="Clock" size={15} className="text-amber-400" />
        <span className="text-sm font-medium text-white">На модерации</span>
        <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-200">{items.length}</span>
        <span className="text-[11px] text-white/40 ml-1 hidden sm:inline">Присвойте статус — карточка уйдёт в нужный список</span>
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 pb-4 pt-1">
        {items.map((i) => {
          const initials = (i.name || i.username || "?").slice(0, 2).toUpperCase();
          const busy = busyId === i.id;
          return (
            <div key={i.id} className="relative shrink-0 w-[230px] rounded-xl border border-white/10 bg-[#14141c] p-2.5">
              <div className="flex gap-2.5">
                <button onClick={() => onOpen(i)} className="w-14 h-14 rounded-lg bg-white/5 overflow-hidden shrink-0 flex items-center justify-center">
                  {i.photo_url ? (
                    <img src={i.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-semibold text-white/30">{initials}</span>
                  )}
                </button>
                <div className="flex-1 min-w-0 text-[11px] space-y-0.5">
                  <div className="text-xs font-semibold text-white truncate">{i.name || "Без имени"}</div>
                  <div className="text-white/50 font-mono truncate">{i.tg_id ? `ID ${i.tg_id}` : "ID —"}</div>
                  <div className="text-white/50 truncate">{i.phone || "—"}</div>
                  <div className="text-sky-300 truncate">{i.username ? `@${i.username}` : "—"}</div>
                </div>
                <button onClick={() => remove(i)} className="self-start p-1 rounded text-white/30 hover:text-red-400">
                  <Icon name="X" size={13} />
                </button>
              </div>

              <button
                onClick={() => setMenuId(menuId === i.id ? null : i.id)}
                disabled={busy}
                className="mt-2 w-full rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 text-xs py-1.5 flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <Icon name={busy ? "Loader2" : "Tag"} size={12} className={busy ? "animate-spin" : ""} />
                Присвоить статус
                <Icon name="ChevronDown" size={12} className={`transition-transform ${menuId === i.id ? "rotate-180" : ""}`} />
              </button>

              {menuId === i.id && (
                <div className="mt-1.5 grid grid-cols-2 gap-1">
                  {LISTS.map((l) => {
                    const black = l.list_type === "black";
                    return (
                      <button
                        key={`${l.role}-${l.list_type}`}
                        onClick={() => assign(i, l.role, l.list_type)}
                        className={`rounded-md px-1.5 py-1.5 text-[10px] leading-tight border ${
                          black
                            ? "border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                            : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                        }`}
                      >
                        {SHORT[`${l.role}-${l.list_type}`]}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ModerationStrip;
