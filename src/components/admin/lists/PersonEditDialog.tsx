import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  HistoryItem, ListDef, ListItem, HISTORY_API, LISTS_API, LOOKUP_API, UPLOAD_API, TG_LOOKUP_API, inputCls, fmtDate,
} from "./listTypes";

interface Props {
  token: string;
  def: ListDef;
  item: ListItem | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const empty = { name: "", username: "", phone: "", tg_id: "", note: "", reason: "", removed_at: "", photo_url: "" };

export function PersonEditDialog({ token, def, item, open, onClose, onSaved }: Props) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetchedFor, setFetchedFor] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const black = def.list_type === "black";

  useEffect(() => {
    if (!open) return;
    setForm(item ? {
      name: item.name, username: item.username, phone: item.phone, tg_id: item.tg_id ? String(item.tg_id) : "",
      note: item.note, reason: item.reason, removed_at: item.removed_at ? item.removed_at.slice(0, 10) : "",
      photo_url: item.photo_url,
    } : empty);
    setHistory([]);
    setFetchedFor(item?.username?.toLowerCase() || "");
    if (item) {
      fetch(`${HISTORY_API}&id=${item.id}`, { headers: { "X-Admin-Token": token } })
        .then((r) => r.json()).then((d) => d.ok && setHistory(d.items || [])).catch(() => {});
    }
  }, [open, item, token]);

  const lookup = async (q: string) => {
    if (q.trim().replace(/^@/, "").length < 3) return;
    try {
      const res = await fetch(`${LOOKUP_API}&q=${encodeURIComponent(q.trim())}`, { headers: { "X-Admin-Token": token } });
      const d = await res.json();
      if (d.found) setForm((f) => ({
        ...f, tg_id: f.tg_id || String(d.tg_id), username: f.username || d.username || "", name: f.name || d.name || "",
      }));
    } catch { /* */ }
  };

  const fromTelegram = async (raw: string, silent = false): Promise<typeof empty | null> => {
    const uname = raw.trim().replace(/^https?:\/\/t\.me\//i, "").replace(/^@/, "").split(/[/?]/)[0];
    if (uname.length < 4) {
      if (!silent) toast.error("Укажите @username");
      return null;
    }
    setFetching(true);
    try {
      const res = await fetch(`${TG_LOOKUP_API}?username=${encodeURIComponent(uname)}`, {
        headers: { "X-Admin-Token": token },
      });
      const d = await res.json().catch(() => ({}));
      if (!d.ok) {
        toast.error(d.error || (res.status >= 500 ? "Telegram не ответил вовремя" : "Не удалось получить данные"));
        return null;
      }
      let next: typeof empty = form;
      setForm((f) => {
        next = {
          ...f,
          username: d.username || uname,
          tg_id: String(d.tg_id),
          name: d.name || f.name,
          phone: f.phone || d.phone || "",
          photo_url: d.photo_url || f.photo_url,
          note: f.note || d.bio || "",
        };
        return next;
      });
      setFetchedFor(uname.toLowerCase());
      toast.success("Данные подтянуты из Telegram", {
        description: [d.name, `ID ${d.tg_id}`, d.phone ? d.phone : "телефон скрыт"].filter(Boolean).join(" · "),
      });
      return next;
    } catch {
      toast.error("Не удалось связаться с Telegram");
      return null;
    } finally {
      setFetching(false);
    }
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const res = await fetch(UPLOAD_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify({ file: b64, content_type: file.type }),
      });
      const d = await res.json();
      if (d.ok) setForm((f) => ({ ...f, photo_url: d.url }));
      else toast.error("Не удалось загрузить фото");
    } catch {
      toast.error("Не удалось загрузить фото");
    }
    setUploading(false);
  };

  const save = async () => {
    if (!form.name.trim() && !form.username.trim() && !form.phone.trim() && !form.tg_id.trim()) {
      toast.error("Укажите @username, Telegram ID или телефон");
      return;
    }
    setSaving(true);
    let data = form;
    const uname = form.username.trim().replace(/^@/, "").toLowerCase();
    if (uname && (!form.tg_id || !form.photo_url) && fetchedFor !== uname) {
      const got = await fromTelegram(form.username, true);
      if (got) data = got;
    }
    try {
      const payload = { ...data, role: def.role, list_type: def.list_type };
      const res = await fetch(LISTS_API, {
        method: item ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify(item ? { id: item.id, ...payload } : payload),
      });
      const d = await res.json();
      if (d.ok) {
        toast.success(item ? "Карточка сохранена" : "Карточка добавлена", {
          description: d.tg_id ? `Telegram ID: ${d.tg_id}` : "Telegram ID пока не найден — подтянется автоматически",
        });
        onSaved();
        onClose();
      } else toast.error("Не удалось сохранить");
    } catch {
      toast.error("Не удалось сохранить");
    }
    setSaving(false);
  };

  const remove = () => {
    if (!item) return;
    toast("Удалить карточку вместе с историей?", {
      action: {
        label: "Удалить",
        onClick: async () => {
          await fetch(`${LISTS_API}&id=${item.id}`, { method: "DELETE", headers: { "X-Admin-Token": token } });
          toast.success("Карточка удалена");
          onSaved();
          onClose();
        },
      },
      cancel: { label: "Отмена", onClick: () => {} },
    });
  };

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-[#14141c] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle>{item ? "Редактировать карточку" : "Новая карточка"}</DialogTitle>
          <DialogDescription className="text-white/50">{def.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-20 h-20 rounded-xl bg-white/5 overflow-hidden flex items-center justify-center shrink-0">
              {form.photo_url ? (
                <img src={form.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Icon name="User" size={28} className="text-white/30" />
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="rounded-xl px-3 py-1.5 text-xs border border-white/10 text-white/80 hover:bg-white/5 flex items-center gap-1.5 disabled:opacity-60"
              >
                <Icon name={uploading ? "Loader2" : "Upload"} size={13} className={uploading ? "animate-spin" : ""} />
                Загрузить фото
              </button>
              {form.photo_url && (
                <button onClick={() => setForm({ ...form, photo_url: "" })} className="text-xs text-white/40 hover:text-white/70 text-left">
                  Убрать фото
                </button>
              )}
              <span className="text-[11px] text-white/35">Или подтянется при сканировании</span>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </div>

          {fetching && (
            <div className="text-xs text-sky-300 flex items-center gap-1.5">
              <Icon name="Loader2" size={12} className="animate-spin" />Получаю фото, имя, ID и телефон из Telegram…
            </div>
          )}
          <input value={form.name} onChange={set("name")} placeholder="Имя" className={inputCls} />
          <div className="grid grid-cols-2 gap-2">
            <input value={form.tg_id} onChange={(e) => setForm({ ...form, tg_id: e.target.value.replace(/\D/g, "") })}
              onBlur={(e) => lookup(e.target.value)} inputMode="numeric" placeholder="Telegram ID" className={inputCls} />
            <input value={form.phone} onChange={set("phone")} placeholder="Телефон" className={inputCls} />
          </div>
          <div className="flex gap-2">
            <input value={form.username} onChange={set("username")}
              onBlur={(e) => {
                const u = e.target.value.trim().replace(/^@/, "").toLowerCase();
                if (u.length >= 4 && u !== fetchedFor && !form.tg_id) fromTelegram(e.target.value, true);
              }}
              placeholder="@username" className={inputCls} />
            <button
              type="button"
              onClick={() => fromTelegram(form.username)}
              disabled={fetching}
              title="Подтянуть данные из Telegram"
              className="shrink-0 rounded-xl px-3 border border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 text-xs flex items-center gap-1.5 disabled:opacity-60"
            >
              <Icon name={fetching ? "Loader2" : "Download"} size={14} className={fetching ? "animate-spin" : ""} />
              Из Telegram
            </button>
          </div>

          {black && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.05] p-3 space-y-2">
              <div className="text-xs font-medium text-red-300">Чёрный список</div>
              <textarea value={form.reason} onChange={set("reason")} rows={3}
                placeholder="За что: например, кинул на предоплату" className={`${inputCls} resize-y`} />
              <label className="block text-xs text-white/50">
                Когда удалён
                <input type="date" value={form.removed_at} onChange={set("removed_at")} className={`${inputCls} mt-1 [color-scheme:dark]`} />
              </label>
            </div>
          )}

          <textarea value={form.note} onChange={set("note")} rows={2} placeholder="Комментарий" className={`${inputCls} resize-y`} />

          {item && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-white/70 flex items-center gap-1.5">
                <Icon name="History" size={13} />История изменений
              </div>
              {history.length === 0 ? (
                <div className="text-xs text-white/40">Изменений пока нет</div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  {history.map((h, i) => (
                    <div key={i} className="rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-[11px]">
                      <div className="flex items-center justify-between text-white/40">
                        <span>{h.label} · {h.source === "scan" ? "сканирование" : "вручную"}</span>
                        <span>{fmtDate(h.changed_at, true)}</span>
                      </div>
                      {h.field === "photo_url" ? (
                        <div className="flex items-center gap-2 mt-1">
                          {h.old ? <img src={h.old} alt="" className="w-8 h-8 rounded object-cover opacity-60" /> : <span className="text-white/30">—</span>}
                          <Icon name="ArrowRight" size={12} className="text-white/40" />
                          {h.new ? <img src={h.new} alt="" className="w-8 h-8 rounded object-cover" /> : <span className="text-white/30">—</span>}
                        </div>
                      ) : (
                        <div className="text-white/80 break-words">
                          <span className="line-through text-white/40">{h.old || "—"}</span>
                          <span className="mx-1 text-white/40">→</span>
                          {h.new || "—"}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button onClick={save} disabled={saving}
              className="grad-btn text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-60 flex items-center gap-2">
              <Icon name={saving ? "Loader2" : "Check"} size={15} className={saving ? "animate-spin" : ""} />
              {saving && fetching ? "Тяну из Telegram…" : "Сохранить"}
            </button>
            <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm border border-white/10 text-white/70 hover:bg-white/5">
              Отмена
            </button>
            {item && (
              <button onClick={remove} className="ml-auto rounded-xl px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-1.5">
                <Icon name="Trash2" size={14} />Удалить
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PersonEditDialog;
