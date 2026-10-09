import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import { KNOWLEDGE_BASE_URL } from "./adminTypes";

type Role = "driver" | "dispatcher";
type ListType = "white" | "black";

interface ListItem {
  id: number;
  role: Role;
  list_type: ListType;
  name: string;
  username: string;
  phone: string;
  note: string;
}

const LISTS: { role: Role; list_type: ListType; title: string; icon: string; color: string }[] = [
  { role: "dispatcher", list_type: "white", title: "Белый список диспетчеров", icon: "ShieldCheck", color: "text-emerald-400" },
  { role: "dispatcher", list_type: "black", title: "Чёрный список диспетчеров", icon: "ShieldX", color: "text-red-400" },
  { role: "driver", list_type: "white", title: "Белый список водителей", icon: "ShieldCheck", color: "text-emerald-400" },
  { role: "driver", list_type: "black", title: "Чёрный список водителей", icon: "ShieldX", color: "text-red-400" },
];

const API = `${KNOWLEDGE_BASE_URL}?entity=lists`;
const emptyForm = { name: "", username: "", phone: "", note: "" };
const inputCls =
  "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-purple-400/60";

interface ListBlockProps {
  token: string;
  def: (typeof LISTS)[number];
  items: ListItem[];
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void;
}

function ListBlock({ token, def, items, expanded, onToggle, onChanged }: ListBlockProps) {
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^@/, "");
    if (!q) return items;
    return items.filter((i) =>
      [i.name, i.username, i.phone, i.note].some((v) => v.toLowerCase().includes(q))
    );
  }, [items, search]);

  const reset = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const save = async () => {
    if (!form.name.trim() && !form.username.trim() && !form.phone.trim()) {
      toast.error("Укажите имя, @username или телефон");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, role: def.role, list_type: def.list_type };
      const res = await fetch(API, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(editingId ? "Сохранено" : "Добавлено");
        reset();
        onChanged();
      } else toast.error("Не удалось сохранить");
    } catch {
      toast.error("Не удалось сохранить");
    }
    setSaving(false);
  };

  const remove = (id: number) => {
    toast("Удалить из списка?", {
      action: {
        label: "Удалить",
        onClick: async () => {
          await fetch(`${API}&id=${id}`, { method: "DELETE", headers: { "X-Admin-Token": token } });
          toast.success("Удалено");
          onChanged();
        },
      },
      cancel: { label: "Отмена", onClick: () => {} },
    });
  };

  const edit = (i: ListItem) => {
    setEditingId(i.id);
    setForm({ name: i.name, username: i.username, phone: i.phone, note: i.note });
    setShowForm(true);
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon name={def.icon} size={15} className={def.color} />
          <span className="text-sm text-white">{def.title}</span>
          <span className="text-[11px] text-white/40">· {items.length}</span>
        </div>
        <Icon name="ChevronDown" size={15} className={`text-white/50 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="p-3 space-y-3 border-t border-white/10">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск: имя, @username, телефон" className={`${inputCls} pl-9`} />
            </div>
            {!showForm && (
              <button
                onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }}
                className="grad-btn text-white rounded-xl px-4 py-2 text-sm font-medium flex items-center justify-center gap-2"
              >
                <Icon name="Plus" size={15} />Добавить
              </button>
            )}
          </div>

          {showForm && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
              <div className="grid sm:grid-cols-3 gap-2">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Имя" className={inputCls} />
                <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="@username" className={inputCls} />
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Телефон" className={inputCls} />
              </div>
              <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder={def.list_type === "black" ? "Причина: например, кинул на предоплату" : "Комментарий"}
                rows={3} className={`${inputCls} resize-y`} />
              <div className="flex gap-2">
                <button onClick={save} disabled={saving}
                  className="grad-btn text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-60 flex items-center gap-2">
                  <Icon name={saving ? "Loader2" : "Check"} size={15} className={saving ? "animate-spin" : ""} />
                  Сохранить
                </button>
                <button onClick={reset}
                  className="rounded-xl px-4 py-2 text-sm border border-white/10 text-white/70 hover:bg-white/5">
                  Отмена
                </button>
              </div>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="text-sm text-white/50 py-4 text-center">
              {items.length ? "Ничего не найдено" : "Список пуст"}
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((i) => (
                <div key={i.id} className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                      {i.name && <span className="text-white">{i.name}</span>}
                      {i.username && <span className="text-sky-300">@{i.username}</span>}
                      {i.phone && <span className="text-white/70">{i.phone}</span>}
                    </div>
                    {i.note && <div className="text-xs text-white/50 mt-0.5 whitespace-pre-wrap">{i.note}</div>}
                  </div>
                  <button onClick={() => edit(i)} className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/5" title="Изменить">
                    <Icon name="Pencil" size={14} />
                  </button>
                  <button onClick={() => remove(i.id)} className="p-1.5 rounded-lg text-white/50 hover:text-red-400 hover:bg-white/5" title="Удалить">
                    <Icon name="Trash2" size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  token: string;
  expanded?: boolean;
  onToggle?: () => void;
}

export function AdminCheckListsTab({ token, expanded, onToggle }: Props) {
  const [items, setItems] = useState<ListItem[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch(API, { headers: { "X-Admin-Token": token } });
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

  return (
    <div className="card-glow rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/10"
      >
        <div className="flex items-center gap-2">
          <Icon name="Users" size={15} className="text-sky-400" />
          <span className="text-sm font-medium text-white">Белые и чёрные списки</span>
          <span className="text-[11px] text-white/40">· {items.length}</span>
        </div>
        <Icon name="ChevronDown" size={16} className={`text-white/50 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="p-4 space-y-2">
          {LISTS.map((def) => {
            const key = `${def.role}-${def.list_type}`;
            return (
              <ListBlock
                key={key}
                token={token}
                def={def}
                items={items.filter((i) => i.role === def.role && i.list_type === def.list_type)}
                expanded={open === key}
                onToggle={() => setOpen(open === key ? null : key)}
                onChanged={load}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AdminCheckListsTab;
