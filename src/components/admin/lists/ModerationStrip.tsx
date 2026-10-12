import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { BotCleanup } from "./BotCleanup";
import { toast } from "sonner";
import { LISTS, LISTS_API, TG_LOOKUP_API, BULK_IMPORT_API, ListItem } from "./listTypes";
import { ModerationGroupPanel, GroupState } from "./ModerationGroupPanel";
import { ModerationScanProgress, ScanState } from "./ModerationScanProgress";
import { ModerationFilters, ModerationFilter } from "./ModerationFilters";
import { ModerationCard } from "./ModerationCard";
import { ModerationHeader } from "./ModerationHeader";

interface Props {
  token: string;
  onChanged: () => void;
  onOpen: (item: ListItem) => void;
  onBack: () => void;
}

export function ModerationRow({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="group w-full rounded-xl border border-amber-500/25 bg-amber-500/[0.05] hover:bg-amber-500/[0.1] px-4 py-2.5 flex items-center gap-2 text-left transition-colors"
    >
      <Icon name="Clock" size={15} className="text-amber-400" />
      <span className="text-sm font-medium text-white">На модерации</span>
      <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${count ? "bg-amber-500 text-black" : "bg-white/10 text-white/50"}`}>{count}</span>
      <span className="text-[11px] text-white/40 ml-1 hidden sm:inline truncate">
        {count ? "Присвойте статус — карточка уйдёт в нужный список" : "Новые карточки после сканирования появятся здесь"}
      </span>
      <Icon name="ChevronRight" size={16} className="ml-auto shrink-0 text-white/30 group-hover:text-white/70 transition-colors" />
    </button>
  );
}

const PAGE = 60;

export function ModerationPage({ token, onChanged: onParentChanged, onOpen, onBack }: Props) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ModerationFilter>("all");
  const [items, setItems] = useState<ListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ all: 0, new: 0, ok: 0, miss: 0 });
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupChat, setGroupChat] = useState("");
  const [group, setGroup] = useState<GroupState | null>(null);
  const groupStop = useRef(false);
  const [scan, setScan] = useState<ScanState | null>(null);
  const stopRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const reqRef = useRef(0);

  const fetchPage = async (offset: number, append: boolean) => {
    const req = ++reqRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ list_type: "pending", filter, offset: String(offset), limit: String(PAGE) });
      if (query) params.set("q", query);
      const res = await fetch(`${LISTS_API}&${params}`, { headers: { "X-Admin-Token": token } });
      const d = await res.json();
      if (req !== reqRef.current) return;
      if (d.ok) {
        setItems((prev) => (append ? [...prev, ...d.items] : d.items));
        setTotal(d.total);
        setCounts(d.counts);
      }
    } catch {
      toast.error("Не удалось загрузить карточки");
    }
    if (req === reqRef.current) setLoading(false);
  };

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    fetchPage(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, query, token]);

  const onChanged = () => {
    fetchPage(0, false);
    onParentChanged();
  };

  const importFile = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const usernames = text.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
      const res = await fetch(BULK_IMPORT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify({ usernames }),
      });
      const d = await res.json();
      if (d.ok) {
        toast.success(`Добавлено ${d.added}, уже было ${d.skipped}, сразу найдено ID: ${d.matched_ids}`);
        onChanged();
      } else toast.error(d.error || "Не удалось загрузить список");
    } catch {
      toast.error("Не удалось загрузить список");
    }
    setImporting(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const scanGroup = async (mode: "members" | "photos" = "members") => {
    const chat = groupChat.trim();
    if (!chat) return;
    groupStop.current = false;
    setGroup({ running: true, title: chat, added: 0, skipped: 0, total: 0, progress: 0, mode });
    let jobId = 0;
    let fails = 0;
    while (!groupStop.current) {
      try {
        const q = jobId ? `job=${jobId}` : `chat=${encodeURIComponent(chat)}${mode === "photos" ? "&mode=photos" : ""}`;
        const res = await fetch(`${TG_LOOKUP_API}?action=group&${q}`, { headers: { "X-Admin-Token": token } });
        const d = await res.json();
        const j = d.job;
        if (!j) {
          toast.error(d.error || "Не удалось просканировать группу");
          break;
        }
        jobId = j.id;
        fails = 0;
        setGroup({ running: true, title: j.title || chat, added: j.added, skipped: j.skipped, total: j.total, progress: j.progress ?? 0, mode });
        if (j.status === "done" || j.status === "error") {
          if (j.status === "error") toast.error(j.error || "Не удалось просканировать группу");
          else toast.success(mode === "photos"
            ? `Фото загружены: ${j.added}, без фото: ${j.skipped}`
            : `Группа просканирована: новых ${j.added}, уже были в базе ${j.skipped}`);
          break;
        }
      } catch {
        fails += 1;
        if (fails >= 4) { toast.error("Сканирование прервано — нажмите ещё раз, продолжит с места остановки"); break; }
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
    setGroup((g) => (g ? { ...g, running: false } : g));
    onChanged();
  };

  const scanAll = async () => {
    stopRef.current = false;
    let done = 0, found = 0;
    const info = await fetch(`${TG_LOOKUP_API}?action=photo_groups`, { headers: { "X-Admin-Token": token } })
      .then((r) => r.json()).catch(() => null);
    const groups: { chat: string; title: string; need: number }[] = info?.items || [];
    let left = info?.left ?? counts.new;
    setScan({ running: true, done, found, left, phase: groups.length ? "Фото через группы" : "Данные по @username" });

    let groupsPaused = false;
    for (const g of groups) {
      if (stopRef.current || groupsPaused) break;
      let jobId = 0, fails = 0, gotHere = 0;
      while (!stopRef.current) {
        try {
          const q = jobId ? `job=${jobId}` : `chat=${encodeURIComponent(g.chat)}&mode=photos`;
          const d = await fetch(`${TG_LOOKUP_API}?action=group&${q}`, { headers: { "X-Admin-Token": token } }).then((r) => r.json());
          const j = d.job;
          if (!j) break;
          jobId = j.id;
          fails = 0;
          const inc = (j.added || 0) - gotHere;
          gotHere = j.added || 0;
          found += inc; done += inc; left = Math.max(0, left - inc);
          setScan({ running: true, done, found, left, phase: `Фото из группы «${g.title}»` });
          if (j.status === "paused") {
            groupsPaused = true;
            toast(`Telegram попросил паузу для групп — пока добираю фото по @никам`);
            break;
          }
          if (j.status !== "running") break;
        } catch {
          fails += 1;
          if (fails >= 3) break;
          await new Promise((r) => setTimeout(r, 4000));
        }
      }
      onChanged();
    }

    let idle = 0;
    while (!stopRef.current) {
      try {
        const res = await fetch(`${TG_LOOKUP_API}?action=batch&scope=pending_full`, { headers: { "X-Admin-Token": token } });
        const d = await res.json();
        if (!d.ok) break;
        done += d.done;
        found += d.found;
        setScan({ running: true, done, found, left: d.left, phase: "Данные и фото по @username" });
        if (!d.left) break;
        if (!d.done && (d.hour_limit || d.all_paused || d.reserved)) {
          const m = Math.ceil((d.resume_in || 0) / 60);
          const when = d.all_paused && m ? (m >= 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m} мин`) : "";
          setScan({ running: false, done, found, left: d.left, pausedFor: when || "ближайший час" });
          toast("Лимит аккаунтов на поиск исчерпан — бережём их от блокировки. Остальное сканер дотянет сам в фоне");
          onChanged();
          return;
        }
        if (!d.done) {
          idle += 1;
          if (idle >= 3) { toast.error("Сканирование остановилось"); break; }
          await new Promise((r) => setTimeout(r, 20000));
        } else idle = 0;
        if (done % 150 < d.done) onChanged();
      } catch {
        idle += 1;
        if (idle >= 3) break;
      }
    }
    setScan((x) => (x ? { ...x, running: false } : x));
    if (!stopRef.current) toast.success(`Готово: подтянуто ${found}`);
    onChanged();
  };

  const [menuId, setMenuId] = useState<number | null>(null);

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

  const [scanIds, setScanIds] = useState<number[]>([]);
  const scanCard = async (item: ListItem) => {
    if (!item.tg_id && !item.username && item.phone.replace(/\D/g, "").length < 10) {
      toast.error("Нет ни ID, ни @username, ни телефона — искать не по чему");
      return;
    }
    setScanIds((x) => [...x, item.id]);
    try {
      const d = await fetch(`${TG_LOOKUP_API}?rescan=${item.id}`, { headers: { "X-Admin-Token": token } })
        .then((r) => r.json()).catch(() => ({}));
      if (d.ok) {
        setItems((prev) => prev.map((p) => (p.id === item.id ? {
          ...p,
          name: d.name || p.name,
          username: d.username || p.username,
          phone: p.phone || d.phone || "",
          tg_id: p.tg_id || d.tg_id,
          photo_url: d.photo_url || p.photo_url,
          bio: d.bio ?? p.bio,
        } : p)));
        toast.success(d.photo_url ? "Данные и фото подтянуты" : "Данные подтянуты (фото в Telegram нет или скрыто)");
      } else {
        toast.error(d.error || "Не удалось получить данные из Telegram");
      }
    } catch {
      toast.error("Не удалось связаться с Telegram");
    }
    setScanIds((x) => x.filter((v) => v !== item.id));
  };

  const remove = async (item: ListItem, forever: boolean) => {
    await fetch(`${LISTS_API}&id=${item.id}${forever ? "&forever=1" : ""}`, { method: "DELETE", headers: { "X-Admin-Token": token } });
    toast.success(forever ? "Удалено из базы навсегда — сканер больше не добавит" : "Убрано с модерации");
    onChanged();
  };

  return (
    <div className="space-y-4">
      <ModerationHeader
        count={counts.all}
        fileRef={fileRef}
        importing={importing}
        scanRunning={!!scan?.running}
        onBack={onBack}
        onImportFile={importFile}
        onToggleGroup={() => setGroupOpen((v) => !v)}
        onStopScan={() => { stopRef.current = true; }}
        onScanAll={scanAll}
      />

      {groupOpen && (
        <ModerationGroupPanel
          groupChat={groupChat}
          setGroupChat={setGroupChat}
          group={group}
          onStop={() => { groupStop.current = true; }}
          onScan={scanGroup}
        />
      )}

      {scan && <ModerationScanProgress scan={scan} />}

      <BotCleanup token={token} onChanged={onChanged} />

      <ModerationFilters search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} counts={counts} />

      <div className="text-xs text-white/40">Присвойте статус — карточка уйдёт в нужный список.</div>
      {!items.length && (
        <div className="rounded-xl border border-white/10 space-card py-10 text-center text-sm text-white/40">
          {loading ? <Icon name="Loader2" size={18} className="animate-spin inline" /> : counts.all ? "Ничего не найдено" : "Новых карточек нет"}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((i) => (
          <ModerationCard
            key={i.id}
            item={i}
            busy={busyId === i.id}
            scanning={scanIds.includes(i.id)}
            menuOpen={menuId === i.id}
            onToggleMenu={() => setMenuId(menuId === i.id ? null : i.id)}
            onOpen={onOpen}
            onScan={scanCard}
            onRemove={remove}
            onAssign={assign}
          />
        ))}
      </div>
      {total > items.length && (
        <button onClick={() => fetchPage(items.length, true)} disabled={loading}
          className="w-full rounded-xl border border-white/10 py-2.5 text-sm text-white/70 hover:bg-white/5 disabled:opacity-60 flex items-center justify-center gap-2">
          {loading && <Icon name="Loader2" size={14} className="animate-spin" />}
          Показать ещё ({total - items.length})
        </button>
      )}
    </div>
  );
}

export default ModerationPage;
