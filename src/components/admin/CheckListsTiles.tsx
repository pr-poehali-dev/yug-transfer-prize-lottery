import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import { LISTS, LISTS_API, SCAN_API, ListDef, ListItem, inputCls } from "./lists/listTypes";
import { PersonCard } from "./lists/PersonCard";
import { PersonEditDialog } from "./lists/PersonEditDialog";
import { LayersDialog } from "./lists/LayersDialog";
import { ModerationStrip } from "./lists/ModerationStrip";
import { SubscriptionsPage } from "./lists/SubscriptionsPage";
import { GroupsPage } from "./lists/GroupsPage";

interface ListPageProps {
  token: string;
  def: ListDef;
  items: ListItem[];
  onBack: () => void;
  onChanged: () => void;
}

function ListPage({ token, def, items, onBack, onChanged }: ListPageProps) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ListItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [layersItem, setLayersItem] = useState<ListItem | null>(null);
  const [scanningIds, setScanningIds] = useState<number[]>([]);
  const [scanAll, setScanAll] = useState<{ done: number; total: number } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^@/, "");
    if (!q) return items;
    const digits = q.replace(/\D/g, "");
    return items.filter((i) =>
      [i.name, i.username, i.phone, i.note, i.reason, String(i.tg_id ?? "")].some((v) => v.toLowerCase().includes(q)) ||
      (digits.length >= 6 && i.phone.replace(/\D/g, "").includes(digits))
    );
  }, [items, search]);

  const scan = async (ids: number[]) => {
    const res = await fetch(SCAN_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Token": token },
      body: JSON.stringify({ ids }),
    });
    const d = await res.json();
    return (d.results || []) as { id: number; status: string; changes?: number; error?: string }[];
  };

  const scanOne = async (item: ListItem) => {
    if (!item.tg_id) {
      toast.error("У карточки нет Telegram ID — сканировать нечего");
      return;
    }
    setScanningIds((s) => [...s, item.id]);
    try {
      const [r] = await scan([item.id]);
      if (r?.status === "ok") toast.success(r.changes ? `Найдено изменений: ${r.changes}` : "Изменений нет");
      else toast.error(r?.error || "Не удалось просканировать");
      onChanged();
    } catch {
      toast.error("Не удалось просканировать");
    }
    setScanningIds((s) => s.filter((x) => x !== item.id));
  };

  const scanAllItems = async () => {
    const ids = items.filter((i) => i.tg_id).map((i) => i.id);
    if (!ids.length) {
      toast.error("Нет карточек с Telegram ID");
      return;
    }
    let changes = 0;
    setScanAll({ done: 0, total: ids.length });
    for (let i = 0; i < ids.length; i += 4) {
      const chunk = ids.slice(i, i + 4);
      try {
        const res = await scan(chunk);
        changes += res.reduce((a, r) => a + (r.changes || 0), 0);
      } catch { /* */ }
      setScanAll({ done: Math.min(i + 4, ids.length), total: ids.length });
    }
    setScanAll(null);
    onChanged();
    toast.success("Сканирование завершено", { description: `Изменений найдено: ${changes}` });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm border border-white/10 text-white/70 hover:text-white hover:bg-white/5"
        >
          <Icon name="ArrowLeft" size={14} />Назад
        </button>
        <Icon name={def.icon} size={18} className={def.color} />
        <span className="text-base font-medium text-white">{def.title}</span>
        <span className="text-xs text-white/40">· {items.length}</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск: @username, ID, телефон, имя" className={`${inputCls} pl-9`} />
        </div>
        <button
          onClick={scanAllItems}
          disabled={!!scanAll}
          className="rounded-xl px-4 py-2 text-sm border border-white/10 text-white/80 hover:bg-white/5 flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Icon name={scanAll ? "Loader2" : "ScanSearch"} fallback="RefreshCw" size={15} className={scanAll ? "animate-spin" : ""} />
          {scanAll ? `Сканирую ${scanAll.done}/${scanAll.total}` : "Сканировать всех"}
        </button>
        <button
          onClick={() => { setEditing(null); setDialogOpen(true); }}
          className="grad-btn text-white rounded-xl px-4 py-2 text-sm font-medium flex items-center justify-center gap-2"
        >
          <Icon name="Plus" size={15} />Добавить
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-sm text-white/50 py-10 text-center">{items.length ? "Ничего не найдено" : "Список пуст"}</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((i) => (
            <PersonCard
              key={i.id}
              item={i}
              scanning={scanningIds.includes(i.id)}
              onEdit={() => { setEditing(i); setDialogOpen(true); }}
              onScan={() => scanOne(i)}
              onLayers={() => setLayersItem(i)}
            />
          ))}
        </div>
      )}

      <LayersDialog token={token} item={layersItem} open={!!layersItem} onClose={() => setLayersItem(null)} />

      <PersonEditDialog
        token={token}
        def={def}
        item={editing}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={onChanged}
      />
    </div>
  );
}

export function CheckListsTiles({ token, onOpenChange }: { token: string; onOpenChange?: (open: boolean) => void }) {
  const [items, setItems] = useState<ListItem[]>([]);
  const [open, setOpenState] = useState<string | null>(null);
  const setOpen = (v: string | null) => {
    setOpenState(v);
    onOpenChange?.(!!v);
  };
  const current = LISTS.find((d) => `${d.role}-${d.list_type}` === open) || null;
  const [modItem, setModItem] = useState<ListItem | null>(null);
  const pendingItems = items.filter((i) => i.list_type === "pending");

  const load = async () => {
    try {
      const res = await fetch(LISTS_API, { headers: { "X-Admin-Token": token } });
      const data = await res.json();
      if (data.ok) setItems(data.items || []);
    } catch {
      toast.error("Не удалось загрузить списки");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (open === "groups") return <GroupsPage token={token} onBack={() => setOpen(null)} />;
  if (open === "subs") return <SubscriptionsPage token={token} onBack={() => setOpen(null)} />;

  if (current) {
    return (
      <ListPage
        token={token}
        def={current}
        items={items.filter((i) => i.role === current.role && i.list_type === current.list_type)}
        onBack={() => setOpen(null)}
        onChanged={load}
      />
    );
  }

  return (
    <div className="space-y-3">
    <ModerationStrip token={token} items={pendingItems} onChanged={load} onOpen={setModItem} />
    <PersonEditDialog
      token={token}
      def={{ role: "", list_type: "pending", title: "На модерации", icon: "Clock", color: "text-amber-400" }}
      item={modItem}
      open={!!modItem}
      onClose={() => setModItem(null)}
      onSaved={load}
    />
    <div className="grid grid-cols-2 gap-3">
      {LISTS.map((def) => {
        const key = `${def.role}-${def.list_type}`;
        const count = items.filter((i) => i.role === def.role && i.list_type === def.list_type).length;
        const black = def.list_type === "black";
        return (
          <button
            key={key}
            onClick={() => setOpen(key)}
            className={`group text-left rounded-2xl border p-4 md:p-5 min-h-[120px] flex flex-col justify-between transition-all hover:-translate-y-0.5 ${
              black
                ? "border-red-500/25 bg-red-500/[0.06] hover:bg-red-500/[0.12]"
                : "border-emerald-500/25 bg-emerald-500/[0.06] hover:bg-emerald-500/[0.12]"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${black ? "bg-red-500/15" : "bg-emerald-500/15"}`}>
                <Icon name={def.role === "driver" ? "Car" : "Headset"} fallback="Users" size={20} className={def.color} />
              </div>
              <Icon name="ChevronRight" size={18} className="text-white/30 group-hover:text-white/70 transition-colors" />
            </div>
            <div className="mt-3">
              <div className="text-sm md:text-base font-medium text-white leading-snug">{def.title}</div>
              <div className="text-xs text-white/50 mt-0.5">{count} чел.</div>
            </div>
          </button>
        );
      })}
      {([
        { key: "groups", title: "Список групп", sub: "Группы для бота", icon: "MessagesSquare", tone: "sky" },
        { key: "subs", title: "Моя подписка", sub: "Оплаты, доход, статистика", icon: "CreditCard", tone: "violet" },
      ] as const).map((t) => (
        <button
          key={t.key}
          onClick={() => setOpen(t.key)}
          className={`group text-left rounded-2xl border p-4 md:p-5 min-h-[120px] flex flex-col justify-between transition-all hover:-translate-y-0.5 ${
            t.tone === "sky"
              ? "border-sky-500/25 bg-sky-500/[0.06] hover:bg-sky-500/[0.12]"
              : "border-violet-500/25 bg-violet-500/[0.06] hover:bg-violet-500/[0.12]"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.tone === "sky" ? "bg-sky-500/15" : "bg-violet-500/15"}`}>
              <Icon name={t.icon} size={20} className={t.tone === "sky" ? "text-sky-400" : "text-violet-400"} />
            </div>
            <Icon name="ChevronRight" size={18} className="text-white/30 group-hover:text-white/70 transition-colors" />
          </div>
          <div className="mt-3">
            <div className="text-sm md:text-base font-medium text-white leading-snug">{t.title}</div>
            <div className="text-xs text-white/50 mt-0.5">{t.sub}</div>
          </div>
        </button>
      ))}
    </div>
    </div>
  );
}

export default CheckListsTiles;
