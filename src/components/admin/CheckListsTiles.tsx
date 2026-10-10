import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import { LISTS, LISTS_API, COMPLAINTS_API, SCAN_API, TG_LOOKUP_API, LOOKUP_API, ListDef, ListItem, inputCls } from "./lists/listTypes";
import { PersonCard } from "./lists/PersonCard";
import { PersonEditDialog } from "./lists/PersonEditDialog";
import { LayersDialog } from "./lists/LayersDialog";
import { ModerationPage } from "./lists/ModerationStrip";
import { SubscriptionsPage } from "./lists/SubscriptionsPage";
import { GroupsPage } from "./lists/GroupsPage";
import { ComplaintsPage } from "./lists/ComplaintsPage";
import { GlobalScanBar } from "./lists/GlobalScanBar";

interface ListPageProps {
  token: string;
  def: ListDef;
  onBack: () => void;
  onChanged: () => void;
}

const LIST_PAGE = 60;

function ListPage({ token, def, onBack, onChanged: onParentChanged }: ListPageProps) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const reqRef = useRef(0);

  const fetchPage = async (offset: number, append: boolean) => {
    const req = ++reqRef.current;
    setLoading(true);
    try {
      const p = new URLSearchParams({ paged: "1", list_type: def.list_type, role: def.role, offset: String(offset), limit: String(LIST_PAGE) });
      if (query) p.set("q", query);
      const d = await fetch(`${LISTS_API}&${p}`, { headers: { "X-Admin-Token": token } }).then((r) => r.json());
      if (req !== reqRef.current) return;
      if (d.ok) {
        setItems((prev) => (append ? [...prev, ...d.items] : d.items));
        setTotal(d.total || 0);
      }
    } catch {
      toast.error("Не удалось загрузить список");
    }
    if (req === reqRef.current) setLoading(false);
  };

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    fetchPage(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, def.role, def.list_type]);

  const onChanged = () => {
    fetchPage(0, false);
    onParentChanged();
  };
  const [editing, setEditing] = useState<ListItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [layersItem, setLayersItem] = useState<ListItem | null>(null);
  const [scanningIds, setScanningIds] = useState<number[]>([]);
  const [scanAll, setScanAll] = useState<{ done: number; total: number } | null>(null);

  const filtered = items;

  const scan = async (ids: number[]) => {
    const res = await fetch(SCAN_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Token": token },
      body: JSON.stringify({ ids }),
    });
    const d = await res.json();
    return (d.results || []) as { id: number; status: string; changes?: number; error?: string }[];
  };

  const fillFromTelegram = async (item: ListItem) => {
    const digits = item.phone.replace(/\D/g, "");
    const q = item.username.length >= 4 ? `username=${encodeURIComponent(item.username)}` : digits.length >= 10 ? `phone=${digits}` : "";
    if (!q) {
      toast.error("Добавьте в карточку @username или номер телефона");
      return;
    }
    setScanningIds((s) => [...s, item.id]);
    try {
      const res = await fetch(`${TG_LOOKUP_API}?${q}`, { headers: { "X-Admin-Token": token } });
      const d = await res.json().catch(() => ({}));
      if (!d.ok) {
        const cacheQ = item.username || (digits.length >= 10 ? digits : "");
        const c = cacheQ
          ? await fetch(`${LOOKUP_API}&q=${encodeURIComponent(cacheQ)}`, { headers: { "X-Admin-Token": token } })
              .then((r) => r.json()).catch(() => ({}))
          : {};
        if (c.found) {
          await fetch(LISTS_API, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "X-Admin-Token": token },
            body: JSON.stringify({
              id: item.id, role: item.role, list_type: item.list_type, name: item.name || c.name,
              username: item.username || c.username, phone: item.phone, tg_id: c.tg_id, photo_url: item.photo_url,
              note: item.note, reason: item.reason, removed_at: item.removed_at,
            }),
          });
          const [r] = await scan([item.id]);
          if (r?.status === "ok") toast.success("Данные обновлены через бота");
          else toast.error(r?.error || "Бот не видит этот аккаунт");
          onChanged();
          return;
        }
        toast.error(d.error || "Не удалось получить данные из Telegram");
        return;
      }
      await fetch(LISTS_API, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify({
          id: item.id, role: item.role, list_type: item.list_type,
          name: d.name || item.name, username: d.username || item.username, phone: item.phone || d.phone || "",
          tg_id: d.tg_id, photo_url: d.photo_url || item.photo_url, note: item.note || d.bio || "",
          reason: item.reason, removed_at: item.removed_at,
        }),
      });
      toast.success("Данные подтянуты из Telegram");
      onChanged();
    } catch {
      toast.error("Не удалось связаться с Telegram");
    } finally {
      setScanningIds((s) => s.filter((x) => x !== item.id));
    }
  };

  const scanOne = async (item: ListItem) => {
    const hasQuery = item.username.length >= 4 || item.phone.replace(/\D/g, "").length >= 10;
    if (!item.tg_id && !hasQuery) {
      await fillFromTelegram(item);
      return;
    }
    setScanningIds((s) => [...s, item.id]);
    try {
      if (hasQuery) {
        const d = await fetch(`${TG_LOOKUP_API}?rescan=${item.id}`, { headers: { "X-Admin-Token": token } })
          .then((r) => r.json()).catch(() => ({}));
        if (d.ok && d.scan) {
          toast.success(d.scan.changes ? `Найдено изменений: ${d.scan.changes} — создан новый слой` : "Изменений нет");
          onChanged();
          setScanningIds((s) => s.filter((x) => x !== item.id));
          return;
        }
        if (!item.tg_id) {
          toast.error(d.error || "Не удалось получить данные из Telegram");
          setScanningIds((s) => s.filter((x) => x !== item.id));
          return;
        }
      }
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
        <span className="text-xs text-white/40">· {total}</span>
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
        <div className="text-sm text-white/50 py-10 text-center">{loading ? "Загрузка…" : query ? "Ничего не найдено" : "Список пуст"}</div>
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

      {items.length > 0 && items.length < total && (
        <button onClick={() => fetchPage(items.length, true)} disabled={loading}
          className="w-full rounded-xl border border-white/10 space-card py-3 text-sm text-white/70 hover:text-white disabled:opacity-60">
          {loading ? "Загрузка…" : `Показать ещё (${total - items.length})`}
        </button>
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
  const [pendingCount, setPendingCount] = useState(0);
  const [listCounts, setListCounts] = useState<Record<string, number>>({});
  const [complaintsNew, setComplaintsNew] = useState(0);

  const load = async () => {
    try {
      const res = await fetch(LISTS_API, { headers: { "X-Admin-Token": token } });
      const data = await res.json();
      if (data.ok) {
        setItems(data.items || []);
        setPendingCount(data.pending_count || 0);
        setListCounts(data.list_counts || {});
      }
      fetch(`${COMPLAINTS_API}&status=new`, { headers: { "X-Admin-Token": token } })
        .then((r) => r.json()).then((c) => c.ok && setComplaintsNew(c.new_count || 0)).catch(() => {});
    } catch {
      toast.error("Не удалось загрузить списки");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const modDialog = (
    <PersonEditDialog
      token={token}
      def={{ role: "", list_type: "pending", title: "На модерации", icon: "Clock", color: "text-amber-400" }}
      item={modItem}
      open={!!modItem}
      onClose={() => setModItem(null)}
      onSaved={load}
    />
  );

  if (open === "moderation") {
    return (
      <>
        <ModerationPage token={token} onChanged={load} onOpen={setModItem} onBack={() => setOpen(null)} />
        {modDialog}
      </>
    );
  }
  if (open === "complaints") return <ComplaintsPage token={token} onBack={() => { setOpen(null); load(); }} />;
  if (open === "groups") return <GroupsPage token={token} onBack={() => setOpen(null)} />;
  if (open === "subs") return <SubscriptionsPage token={token} onBack={() => setOpen(null)} />;

  if (current) {
    return (
      <ListPage
        token={token}
        def={current}
        onBack={() => setOpen(null)}
        onChanged={load}
      />
    );
  }

  const toneMap: Record<string, { box: string; icon: string; text: string }> = {
    amber: { box: "border-amber-400/30 hover:border-amber-400/60 hover:shadow-[0_0_40px_-10px_rgba(251,191,36,0.6)]", icon: "bg-amber-500/20", text: "text-amber-300" },
    red: { box: "border-red-400/30 hover:border-red-400/60 hover:shadow-[0_0_40px_-10px_rgba(248,113,113,0.6)]", icon: "bg-red-500/20", text: "text-red-300" },
    emerald: { box: "border-emerald-400/30 hover:border-emerald-400/60 hover:shadow-[0_0_40px_-10px_rgba(52,211,153,0.6)]", icon: "bg-emerald-500/20", text: "text-emerald-300" },
    sky: { box: "border-sky-400/30 hover:border-sky-400/60 hover:shadow-[0_0_40px_-10px_rgba(56,189,248,0.6)]", icon: "bg-sky-500/20", text: "text-sky-300" },
    violet: { box: "border-violet-400/30 hover:border-violet-400/60 hover:shadow-[0_0_40px_-10px_rgba(167,139,250,0.6)]", icon: "bg-violet-500/20", text: "text-violet-300" },
  };
  const tiles: { key: string; title: string; sub: string; icon: string; tone: string; badge?: number }[] = [
    { key: "moderation", title: "На модерации", sub: `${pendingCount} карточек`, icon: "Clock", tone: "amber" },
    { key: "complaints", title: "Жалобы", sub: complaintsNew ? `${complaintsNew} новых` : "Новых нет", icon: "ShieldAlert", tone: "red", badge: complaintsNew },
    ...LISTS.map((def) => ({
      key: `${def.role}-${def.list_type}`,
      title: def.title,
      sub: `${listCounts[`${def.role}-${def.list_type}`] ?? items.filter((i) => i.role === def.role && i.list_type === def.list_type).length} чел.`,
      icon: def.role === "driver" ? "Car" : "Headset",
      tone: def.list_type === "black" ? "red" : "emerald",
    })),
    { key: "groups", title: "Список групп", sub: "Группы для бота", icon: "MessagesSquare", tone: "sky" },
    { key: "subs", title: "Моя подписка", sub: "Оплаты, доход, статистика", icon: "CreditCard", tone: "violet" },
  ];

  return (
    <div className="space-y-3">
    <GlobalScanBar token={token} onChanged={load} />
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {tiles.map((t) => {
        const c = toneMap[t.tone];
        return (
          <button
            key={t.key}
            onClick={() => setOpen(t.key)}
            className={`group relative text-left rounded-2xl border bg-white/[0.04] backdrop-blur-xl p-4 min-h-[112px] lg:min-h-[130px] flex flex-col justify-between transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/[0.07] ${c.box}`}
          >
            <div className="flex items-center justify-between">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.icon}`}>
                <Icon name={t.icon} fallback="Users" size={19} className={c.text} />
              </div>
              {t.badge ? (
                <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-red-500 text-white">{t.badge}</span>
              ) : (
                <Icon name="ChevronRight" size={18} className="text-white/30 group-hover:text-white/70 transition-colors" />
              )}
            </div>
            <div className="mt-3">
              <div className="text-sm md:text-base font-medium text-white leading-snug">{t.title}</div>
              <div className="text-xs text-white/50 mt-0.5">{t.sub}</div>
            </div>
          </button>
        );
      })}
    </div>
    </div>
  );
}

export default CheckListsTiles;
