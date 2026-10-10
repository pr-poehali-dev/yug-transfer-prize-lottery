import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import { KNOWLEDGE_BASE_URL } from "../adminTypes";

interface Group {
  id: number;
  title: string;
  category: string;
  content: string;
}

const PAGE = 60;
const fieldCls =
  "w-full rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-sky-400/60";

const splitContent = (content: string) => {
  const lines = (content || "").split("\n");
  const first = (lines[0] || "").trim();
  if (/^https?:\/\//.test(first)) return { link: first, note: lines.slice(1).join("\n").trim() };
  const m = content.match(/https?:\/\/\S+/);
  return { link: m ? m[0] : "", note: m ? content.replace(m[0], "").trim() : content.trim() };
};
const joinContent = (link: string, note: string) => [link.trim(), note.trim()].filter(Boolean).join("\n");
const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е");

function parseQuick(text: string): { title: string; link: string } | null {
  const m = text.match(/(https?:\/\/t\.me\/\S+|t\.me\/\S+|@[A-Za-z0-9_]{4,})/);
  if (!m) return null;
  let link = m[0].replace(/[),]+$/, "");
  if (link.startsWith("@")) link = `https://t.me/${link.slice(1)}`;
  if (link.startsWith("t.me")) link = `https://${link}`;
  const title = text.replace(m[0], "").replace(/^\s*\d+[.)]\s*/, "").replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
  return { title: title || link.replace("https://t.me/", ""), link };
}

export function GroupsPage({ token, onBack }: { token: string; onBack: () => void }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [editId, setEditId] = useState<number | null>(null);
  const [edit, setEdit] = useState({ title: "", link: "", note: "" });
  const [quick, setQuick] = useState("");
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const res = await fetch(KNOWLEDGE_BASE_URL, { headers: { "X-Admin-Token": token } });
      const d = await res.json();
      if (d.ok) {
        setGroups(
          (d.items || [])
            .filter((i: Group) => /групп/i.test(i.category) || /групп/i.test(i.title))
            .sort((a: Group, b: Group) => a.id - b.id),
        );
      }
    } catch { /* */ }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => setLimit(PAGE), [q]);

  const numbered = useMemo(() => groups.map((g, i) => ({ ...g, n: i + 1 })), [groups]);
  const filtered = useMemo(() => {
    const s = norm(q.trim());
    if (!s) return numbered;
    if (/^\d+$/.test(s)) {
      const byNum = numbered.filter((g) => g.n === Number(s));
      if (byNum.length) return byNum;
    }
    return numbered.filter((g) => norm(`${g.title} ${g.content}`).includes(s));
  }, [numbered, q]);

  const linkSet = useMemo(() => {
    const m = new Map<string, number>();
    groups.forEach((g) => {
      const l = splitContent(g.content).link.toLowerCase();
      if (l) m.set(l, g.id);
    });
    return m;
  }, [groups]);

  const send = async (method: "POST" | "PUT", body: Record<string, unknown>) => {
    const res = await fetch(KNOWLEDGE_BASE_URL, {
      method,
      headers: { "Content-Type": "application/json", "X-Admin-Token": token },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const addQuick = async () => {
    const p = parseQuick(quick);
    if (!p) {
      toast.error("Вставьте название и ссылку t.me/… или @username");
      return;
    }
    if (linkSet.has(p.link.toLowerCase())) {
      toast.error("Такая ссылка уже есть в списке");
      return;
    }
    setBusy(true);
    try {
      const d = await send("POST", { title: p.title, category: "Группы", content: p.link });
      if (d.ok) {
        setGroups((prev) => [...prev, { id: d.id, title: p.title, category: "Группы", content: p.link }]);
        setQuick("");
        toast.success(`Добавлено: ${p.title}`);
      } else toast.error("Не удалось добавить");
    } catch {
      toast.error("Не удалось добавить");
    }
    setBusy(false);
  };

  const startEdit = (g: Group) => {
    const { link, note } = splitContent(g.content);
    setEditId(g.id);
    setEdit({ title: g.title, link, note });
  };

  const saveEdit = async () => {
    if (!editId) return;
    if (!edit.title.trim()) {
      toast.error("Укажите название");
      return;
    }
    const dup = linkSet.get(edit.link.trim().toLowerCase());
    if (dup && dup !== editId) {
      toast.error("Такая ссылка уже есть у другой группы");
      return;
    }
    setBusy(true);
    const content = joinContent(edit.link, edit.note);
    try {
      const d = await send("PUT", { id: editId, title: edit.title.trim(), category: "Группы", content });
      if (d.ok) {
        setGroups((prev) => prev.map((g) => (g.id === editId ? { ...g, title: edit.title.trim(), content } : g)));
        setEditId(null);
        toast.success("Сохранено");
      } else toast.error("Не удалось сохранить");
    } catch {
      toast.error("Не удалось сохранить");
    }
    setBusy(false);
  };

  const remove = (g: Group) => {
    toast(`Удалить «${g.title}»?`, {
      action: {
        label: "Удалить",
        onClick: async () => {
          await fetch(`${KNOWLEDGE_BASE_URL}?id=${g.id}`, { method: "DELETE", headers: { "X-Admin-Token": token } });
          setGroups((prev) => prev.filter((x) => x.id !== g.id));
          toast.success("Удалено");
        },
      },
      cancel: { label: "Отмена", onClick: () => {} },
    });
  };

  const parsed = quick.trim() ? parseQuick(quick) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm border border-white/10 text-white/70 hover:text-white hover:bg-white/5">
          <Icon name="ArrowLeft" size={14} />Назад
        </button>
        <Icon name="MessagesSquare" size={18} className="text-sky-400" />
        <span className="text-base font-medium text-white">Список групп</span>
        <span className="text-xs text-white/40">· {groups.length}</span>
        <span className="text-xs text-white/30 hidden sm:inline">· бот показывает их по кнопке «📋 Список групп»</span>
      </div>

      <div className="sticky top-0 z-10 -mx-1 px-1 py-2 space-y-2 bg-[hsl(var(--background))]/90 backdrop-blur">
        <div className="relative">
          <Icon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по названию, ссылке или номеру…  (клавиша /)"
            className={`${fieldCls} pl-9 pr-9 py-2`} />
          {q && (
            <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white">
              <Icon name="X" size={14} />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Icon name="Plus" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400" />
            <input value={quick} onChange={(e) => setQuick(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addQuick()}
              placeholder="Быстро добавить: Название https://t.me/…  → Enter"
              className={`${fieldCls} pl-9 py-2`} />
          </div>
          <button onClick={addQuick} disabled={busy || !parsed}
            className="grad-btn text-white rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-40 flex items-center gap-1.5 shrink-0">
            <Icon name={busy ? "Loader2" : "Plus"} size={14} className={busy ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Добавить</span>
          </button>
        </div>
        {parsed && (
          <div className="text-xs text-white/50 px-1">
            Будет добавлено: <span className="text-white">{parsed.title}</span> · <span className="text-sky-300">{parsed.link}</span>
            {linkSet.has(parsed.link.toLowerCase()) && <span className="text-amber-400"> · уже есть в списке</span>}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-white/50 py-10 text-center">Загрузка…</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-white/50 py-10 text-center">{q ? "Ничего не найдено" : "Групп пока нет — добавьте первую"}</div>
      ) : (
        <>
          {q && <div className="text-xs text-white/40 px-1">Найдено: {filtered.length}</div>}
          <div className="rounded-xl border border-white/10 divide-y divide-white/5 overflow-hidden">
            {filtered.slice(0, limit).map((g) => {
              const { link, note } = splitContent(g.content);
              if (editId === g.id) {
                return (
                  <div key={g.id} className="p-2.5 bg-sky-500/[0.06] space-y-2">
                    <div className="grid sm:grid-cols-2 gap-2">
                      <input autoFocus value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditId(null); }}
                        placeholder="Название" className={fieldCls} />
                      <input value={edit.link} onChange={(e) => setEdit({ ...edit, link: e.target.value })}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditId(null); }}
                        placeholder="https://t.me/…" className={fieldCls} />
                    </div>
                    <input value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditId(null); }}
                      placeholder="Примечание (необязательно): например, вход через бот @…" className={fieldCls} />
                    <div className="flex gap-2">
                      <button onClick={saveEdit} disabled={busy}
                        className="grad-btn text-white rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60 flex items-center gap-1.5">
                        <Icon name={busy ? "Loader2" : "Check"} size={13} className={busy ? "animate-spin" : ""} />Сохранить
                      </button>
                      <button onClick={() => setEditId(null)}
                        className="rounded-lg px-3 py-1.5 text-xs border border-white/10 text-white/70 hover:bg-white/5">Отмена</button>
                      <button onClick={() => remove(g)}
                        className="ml-auto rounded-lg px-3 py-1.5 text-xs text-red-400/80 hover:text-red-400 hover:bg-white/5 flex items-center gap-1.5">
                        <Icon name="Trash2" size={13} />Удалить
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={g.id} onDoubleClick={() => startEdit(g)}
                  className="group flex items-center gap-2 px-2.5 py-1.5 hover:bg-white/[0.03]">
                  <span className="w-8 text-right text-[11px] tabular-nums text-white/30 shrink-0">{g.n}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{g.title}</div>
                    <div className="text-[11px] text-white/40 truncate">
                      {link ? link.replace("https://", "") : "нет ссылки"}
                      {note && <span className="text-amber-300/70"> · {note.replace(/\n/g, " ")}</span>}
                    </div>
                  </div>
                  {link && (
                    <a href={link} target="_blank" rel="noreferrer" title="Открыть"
                      className="p-1.5 rounded-md text-sky-300/70 hover:text-sky-300 hover:bg-white/5">
                      <Icon name="ExternalLink" size={14} />
                    </a>
                  )}
                  <button onClick={() => startEdit(g)} title="Редактировать"
                    className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/5">
                    <Icon name="Pencil" size={14} />
                  </button>
                  <button onClick={() => remove(g)} title="Удалить"
                    className="p-1.5 rounded-md text-white/30 hover:text-red-400 hover:bg-white/5 sm:opacity-0 sm:group-hover:opacity-100">
                    <Icon name="Trash2" size={14} />
                  </button>
                </div>
              );
            })}
          </div>
          {filtered.length > limit && (
            <button onClick={() => setLimit(limit + PAGE * 2)}
              className="w-full rounded-lg py-2 text-sm border border-white/10 text-white/60 hover:bg-white/5">
              Показать ещё ({filtered.length - limit})
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default GroupsPage;
