import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import { KNOWLEDGE_BASE_URL, KB_BOT_URL } from "./adminTypes";
import { CheckListsTiles } from "./CheckListsTiles";

interface KnowledgeItem {
  id: number;
  title: string;
  category: string;
  content: string;
  updated_at: string | null;
}

interface Props {
  token: string;
  expanded?: boolean;
  onToggle?: () => void;
}

const emptyForm = { title: "", category: "", content: "" };

export function AdminKnowledgeTab({ token, expanded, onToggle }: Props) {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [bot, setBot] = useState<{ username: string; webhook: string } | null>(null);
  const fetchBot = async () => {
    try {
      const res = await fetch(`${KB_BOT_URL}?action=bot_info`);
      const data = await res.json();
      setBot({ username: data.username || "", webhook: data.webhook || "" });
    } catch { /* */ }
  };

  const fetchItems = async () => {
    try {
      const res = await fetch(KNOWLEDGE_BASE_URL, { headers: { "X-Admin-Token": token } });
      const data = await res.json();
      if (data.ok) setItems(data.items || []);
    } catch {
      toast.error("Не удалось загрузить базу знаний");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
    fetchBot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      [i.title, i.category, i.content].some((v) => v.toLowerCase().includes(q))
    );
  }, [items, search]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("Укажите заголовок");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(KNOWLEDGE_BASE_URL, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify(editingId ? { id: editingId, ...form } : form),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(editingId ? "Запись обновлена" : "Запись добавлена");
        resetForm();
        fetchItems();
      } else toast.error("Не удалось сохранить");
    } catch {
      toast.error("Не удалось сохранить");
    }
    setSaving(false);
  };

  const handleEdit = (item: KnowledgeItem) => {
    setEditingId(item.id);
    setForm({ title: item.title, category: item.category, content: item.content });
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    toast("Удалить эту запись?", {
      action: {
        label: "Удалить",
        onClick: async () => {
          await fetch(`${KNOWLEDGE_BASE_URL}?id=${id}`, {
            method: "DELETE",
            headers: { "X-Admin-Token": token },
          });
          toast.success("Запись удалена");
          fetchItems();
        },
      },
      cancel: { label: "Отмена", onClick: () => {} },
    });
  };

  const inputCls =
    "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-purple-400/60";

  return (
    <div className="card-glow rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/10"
      >
        <div className="flex items-center gap-2">
          <Icon name="BookOpen" size={15} className="text-emerald-400" />
          <span className="text-sm font-medium text-white">База знаний</span>
          <span className="text-[11px] text-white/40">· {items.length}</span>
        </div>
        <Icon
          name="ChevronDown"
          size={16}
          className={`text-white/50 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {bot?.username && (
            <a
              href={`https://t.me/${bot.username}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white"
            >
              <Icon name="Bot" size={15} className="text-sky-400" />
              @{bot.username}
            </a>
          )}
          <CheckListsTiles token={token} />
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по базе знаний"
                className={`${inputCls} pl-9`}
              />
            </div>
            {!showForm && (
              <button
                onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }}
                className="grad-btn text-white rounded-xl px-4 py-2 text-sm font-medium flex items-center justify-center gap-2"
              >
                <Icon name="Plus" size={15} />Добавить запись
              </button>
            )}
          </div>

          {showForm && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <div className="text-sm font-medium text-white">
                {editingId ? "Редактирование записи" : "Новая запись"}
              </div>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Заголовок"
                className={inputCls}
              />
              <input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Раздел (например: Тарифы, Правила, Ответы клиентам)"
                className={inputCls}
              />
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Текст"
                rows={8}
                className={`${inputCls} resize-y`}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="grad-btn text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-60 flex items-center gap-2"
                >
                  <Icon name={saving ? "Loader2" : "Check"} size={15} className={saving ? "animate-spin" : ""} />
                  Сохранить
                </button>
                <button
                  onClick={resetForm}
                  className="rounded-xl px-4 py-2 text-sm border border-white/10 text-white/70 hover:bg-white/5"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-sm text-white/50 py-6 text-center">Загрузка…</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-white/50 py-6 text-center">
              {items.length ? "Ничего не найдено" : "Пока пусто — добавьте первую запись"}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.03]">
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <button
                      onClick={() => setOpenId(openId === item.id ? null : item.id)}
                      className="flex-1 min-w-0 text-left flex items-center gap-2"
                    >
                      <Icon
                        name="ChevronRight"
                        size={14}
                        className={`text-white/40 shrink-0 transition-transform ${openId === item.id ? "rotate-90" : ""}`}
                      />
                      <span className="text-sm text-white truncate">{item.title}</span>
                      {item.category && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 shrink-0">
                          {item.category}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => { navigator.clipboard.writeText(item.content); toast.success("Текст скопирован"); }}
                      className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/5"
                      title="Копировать"
                    >
                      <Icon name="Copy" size={14} />
                    </button>
                    <button
                      onClick={() => handleEdit(item)}
                      className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/5"
                      title="Изменить"
                    >
                      <Icon name="Pencil" size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 rounded-lg text-white/50 hover:text-red-400 hover:bg-white/5"
                      title="Удалить"
                    >
                      <Icon name="Trash2" size={14} />
                    </button>
                  </div>
                  {openId === item.id && (
                    <div className="px-4 pb-3 text-sm text-white/80 whitespace-pre-wrap border-t border-white/5 pt-3">
                      {item.content || <span className="text-white/40">Нет текста</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminKnowledgeTab;
