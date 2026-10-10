import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import { KNOWLEDGE_BASE_URL } from "../adminTypes";
import { inputCls } from "./listTypes";

interface Group {
  id: number;
  title: string;
  category: string;
  content: string;
}

const empty = { title: "", content: "" };

export function GroupsPage({ token, onBack }: { token: string; onBack: () => void }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await fetch(KNOWLEDGE_BASE_URL, { headers: { "X-Admin-Token": token } });
      const d = await res.json();
      if (d.ok) {
        setGroups((d.items || []).filter((i: Group) => /групп/i.test(i.category) || /групп/i.test(i.title)));
      }
    } catch { /* */ }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const reset = () => {
    setForm(empty);
    setEditingId(null);
    setShowForm(false);
  };

  const save = async () => {
    if (!form.title.trim()) {
      toast.error("Укажите название группы");
      return;
    }
    setSaving(true);
    try {
      const body = { title: form.title, content: form.content, category: "Группы" };
      const res = await fetch(KNOWLEDGE_BASE_URL, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify(editingId ? { id: editingId, ...body } : body),
      });
      const d = await res.json();
      if (d.ok) {
        toast.success(editingId ? "Группа обновлена" : "Группа добавлена");
        reset();
        load();
      } else toast.error("Не удалось сохранить");
    } catch {
      toast.error("Не удалось сохранить");
    }
    setSaving(false);
  };

  const remove = (id: number) => {
    toast("Удалить группу из списка?", {
      action: {
        label: "Удалить",
        onClick: async () => {
          await fetch(`${KNOWLEDGE_BASE_URL}?id=${id}`, { method: "DELETE", headers: { "X-Admin-Token": token } });
          toast.success("Удалено");
          load();
        },
      },
      cancel: { label: "Отмена", onClick: () => {} },
    });
  };

  const linkOf = (text: string) => text.match(/(https?:\/\/t\.me\/\S+|@[A-Za-z0-9_]{4,})/)?.[0] || "";
  const href = (l: string) => (l.startsWith("@") ? `https://t.me/${l.slice(1)}` : l);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBack}
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm border border-white/10 text-white/70 hover:text-white hover:bg-white/5">
          <Icon name="ArrowLeft" size={14} />Назад
        </button>
        <Icon name="MessagesSquare" size={18} className="text-sky-400" />
        <span className="text-base font-medium text-white">Список групп</span>
        <span className="text-xs text-white/40">· {groups.length}</span>
        {!showForm && (
          <button onClick={() => { setForm(empty); setEditingId(null); setShowForm(true); }}
            className="ml-auto grad-btn text-white rounded-xl px-4 py-2 text-sm font-medium flex items-center gap-2">
            <Icon name="Plus" size={15} />Добавить группу
          </button>
        )}
      </div>

      <div className="text-xs text-white/40">Этот список бот показывает по кнопке «📋 Список групп».</div>

      {showForm && (
        <div className="rounded-xl border border-white/10 space-card p-4 space-y-2">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Название группы" className={inputCls} />
          <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={3}
            placeholder="Ссылка и описание, например: https://t.me/... — заказы по Краснодару" className={`${inputCls} resize-y`} />
          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="grad-btn text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-60 flex items-center gap-2">
              <Icon name={saving ? "Loader2" : "Check"} size={15} className={saving ? "animate-spin" : ""} />Сохранить
            </button>
            <button onClick={reset} className="rounded-xl px-4 py-2 text-sm border border-white/10 text-white/70 hover:bg-white/5">
              Отмена
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-white/50 py-10 text-center">Загрузка…</div>
      ) : groups.length === 0 ? (
        <div className="text-sm text-white/50 py-10 text-center">Групп пока нет — добавьте первую</div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {groups.map((g) => {
            const link = linkOf(g.content);
            return (
              <div key={g.id} className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.04] p-4 flex flex-col gap-2">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/15 flex items-center justify-center shrink-0">
                    <Icon name="Users" size={18} className="text-sky-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">{g.title}</div>
                    {g.content && <div className="text-xs text-white/50 whitespace-pre-wrap break-words mt-0.5 line-clamp-3">{g.content}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-auto pt-1">
                  {link && (
                    <a href={href(link)} target="_blank" rel="noreferrer"
                      className="rounded-xl px-3 py-1.5 text-xs border border-white/10 text-sky-300 hover:bg-white/5 flex items-center gap-1.5">
                      <Icon name="ExternalLink" size={12} />Открыть
                    </a>
                  )}
                  <button onClick={() => { setEditingId(g.id); setForm({ title: g.title, content: g.content }); setShowForm(true); }}
                    className="rounded-xl px-3 py-1.5 text-xs border border-white/10 text-white/70 hover:bg-white/5 flex items-center gap-1.5">
                    <Icon name="Pencil" size={12} />Редактировать
                  </button>
                  <button onClick={() => remove(g.id)} className="ml-auto p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-white/5">
                    <Icon name="Trash2" size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default GroupsPage;
