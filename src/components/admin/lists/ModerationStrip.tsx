import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import { LISTS, LISTS_API, TG_LOOKUP_API, BULK_IMPORT_API, ListItem, inputCls } from "./listTypes";

interface Props {
  token: string;
  onChanged: () => void;
  onOpen: (item: ListItem) => void;
  onBack: () => void;
}

const SHORT: Record<string, string> = {
  "dispatcher-white": "Белый · диспетчер",
  "dispatcher-black": "Чёрный · диспетчер",
  "driver-white": "Белый · водитель",
  "driver-black": "Чёрный · водитель",
};

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
  const [filter, setFilter] = useState<"all" | "new" | "ok" | "miss">("all");
  const [items, setItems] = useState<ListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ all: 0, new: 0, ok: 0, miss: 0 });
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupChat, setGroupChat] = useState("");
  const [group, setGroup] = useState<{ running: boolean; title: string; added: number; skipped: number; total: number; progress: number; mode?: string } | null>(null);
  const groupStop = useRef(false);
  const [scan, setScan] = useState<{ running: boolean; done: number; found: number; left: number; pausedFor?: string } | null>(null);
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
    setScan({ running: true, done, found, left: counts.new });
    let idle = 0;
    while (!stopRef.current) {
      try {
        const res = await fetch(`${TG_LOOKUP_API}?action=batch`, { headers: { "X-Admin-Token": token } });
        const d = await res.json();
        if (!d.ok) break;
        done += d.done;
        found += d.found;
        setScan({ running: true, done, found, left: d.left });
        if (!d.left) break;
        if (!d.done && d.all_paused) {
          const m = Math.ceil((d.resume_in || 0) / 60);
          const when = m >= 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m} мин`;
          setScan({ running: false, done, found, left: d.left, pausedFor: when });
          toast.error(`Telegram ограничил поиск на всех аккаунтах. Первый освободится через ${when}`);
          onChanged();
          return;
        }
        if (!d.done) {
          idle += 1;
          if (idle >= 3) {
            toast.error(d.paused ? "Telegram попросил паузу — продолжим позже автоматически" : "Сканирование остановилось");
            break;
          }
          await new Promise((r) => setTimeout(r, 20000));
        } else idle = 0;
        if (done % 150 < d.done) onChanged();
      } catch {
        idle += 1;
        if (idle >= 3) break;
      }
    }
    setScan((s) => (s ? { ...s, running: false } : s));
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBack}
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm border border-white/10 text-white/70 hover:text-white hover:bg-white/5">
          <Icon name="ArrowLeft" size={14} />Назад
        </button>
        <Icon name="Clock" size={18} className="text-amber-400" />
        <span className="text-base font-medium text-white">На модерации</span>
        <span className="text-xs text-white/40">· {counts.all}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".txt,.csv" className="hidden"
            onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
          <button onClick={() => setGroupOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm border border-sky-500/40 text-sky-200 hover:bg-sky-500/10">
            <Icon name="Users" size={14} />Сканировать группу
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={importing}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm border border-white/10 text-white/80 hover:bg-white/5 disabled:opacity-60">
            <Icon name={importing ? "Loader2" : "Upload"} size={14} className={importing ? "animate-spin" : ""} />
            Загрузить список
          </button>
          {scan?.running ? (
            <button onClick={() => { stopRef.current = true; }}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-red-500/80 hover:bg-red-500 text-white">
              <Icon name="Square" size={13} />Остановить
            </button>
          ) : (
            <button onClick={scanAll} disabled={!counts.new}
              className="grad-btn text-white rounded-xl px-4 py-2 text-sm font-medium flex items-center gap-2 disabled:opacity-50">
              <Icon name="ScanSearch" fallback="Search" size={15} />Сканировать все{counts.new ? ` (${counts.new})` : ""}
            </button>
          )}
        </div>
      </div>

      {groupOpen && (
        <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.05] p-3 space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={groupChat} onChange={(e) => setGroupChat(e.target.value)} disabled={group?.running}
              placeholder="Ссылка t.me/…, @группа или ID группы (-100…)" className={inputCls} />
            {group?.running ? (
              <button onClick={() => { groupStop.current = true; }}
                className="shrink-0 rounded-xl px-4 py-2 text-sm bg-red-500/80 hover:bg-red-500 text-white">Остановить</button>
            ) : (
              <>
                <button onClick={() => scanGroup("members")} disabled={!groupChat.trim()}
                  className="shrink-0 grad-btn text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50">Участники</button>
                <button onClick={() => scanGroup("photos")} disabled={!groupChat.trim()}
                  className="shrink-0 rounded-xl px-4 py-2 text-sm font-medium border border-sky-400/50 text-sky-200 hover:bg-sky-500/10 disabled:opacity-50 flex items-center gap-1.5">
                  <Icon name="Image" size={14} />Фото
                </button>
              </>
            )}
          </div>
          <div className="text-[11px] text-white/40">
            Участники попадут в «На модерации». Кто уже есть в базе (по Telegram ID или @username) — пропускается, дублей не будет.
            Полный список доступен, если один из ваших аккаунтов — админ группы; иначе соберём тех, кто писал сообщения.
            «Фото» — подтянет аватарки уже загруженных участников этой группы (нужен аккаунт-админ, лимиты поиска не тратятся).
          </div>
          {group && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-2 text-sm text-white">
                {group.running && <Icon name="Loader2" size={14} className="animate-spin text-sky-300" />}
                <span className="truncate">{group.title}</span>
                <span className="ml-auto text-xs text-white/60 shrink-0">
                  {group.mode === "photos" ? `фото ${group.added} · без фото ${group.skipped}` : `новых ${group.added} · уже в базе ${group.skipped}`}
                  {group.total ? ` · в группе ${group.total}` : ""}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-sky-400 transition-all" style={{ width: `${Math.min(100, group.progress)}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {scan && (
        <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.06] px-4 py-3 space-y-2">
          <div className="flex items-center gap-2 text-sm text-white">
            {scan.running && <Icon name="Loader2" size={14} className="animate-spin text-sky-300" />}
            {scan.running ? "Сканирую Telegram…" : "Сканирование остановлено"}
            <span className="ml-auto text-xs text-white/60">проверено {scan.done} · найдено {scan.found} · осталось {scan.left}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-sky-400 transition-all"
              style={{ width: `${Math.min(100, (scan.done / Math.max(1, scan.done + scan.left)) * 100)}%` }} />
          </div>
          {scan.pausedFor ? (
            <div className="text-[11px] text-amber-300/90">
              Telegram временно ограничил поиск по @username на всех аккаунтах. Первый освободится через {scan.pausedFor} —
              тогда нажмите «Сканировать все» снова. Фото участников группы можно грузить и сейчас — кнопкой «Фото».
            </div>
          ) : (
            <div className="text-[11px] text-white/40">Не закрывайте страницу. Можно остановить и продолжить позже — проверенные не повторяются.</div>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени, @username, ID, описанию" className={`${inputCls} pl-9`} />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {([
            ["all", `Все ${counts.all}`], ["new", `Не проверены ${counts.new}`],
            ["ok", `Найдены ${counts.ok}`], ["miss", `Не найдены ${counts.miss}`],
          ] as const).map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs border ${filter === k
                ? "border-amber-400/60 bg-amber-500/15 text-amber-200" : "border-white/10 text-white/60 hover:bg-white/5"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs text-white/40">Присвойте статус — карточка уйдёт в нужный список.</div>
      {!items.length && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] py-10 text-center text-sm text-white/40">
          {loading ? <Icon name="Loader2" size={18} className="animate-spin inline" /> : counts.all ? "Ничего не найдено" : "Новых карточек нет"}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((i) => {
          const initials = (i.name || i.username || "?").slice(0, 2).toUpperCase();
          const busy = busyId === i.id;
          return (
            <div key={i.id} className="relative rounded-xl border border-white/10 bg-[#14141c] p-2.5">
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
