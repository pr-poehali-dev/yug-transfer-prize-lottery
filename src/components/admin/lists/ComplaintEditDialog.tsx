import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { COMPLAINTS_API, UPLOAD_API, inputCls } from "./listTypes";

export interface EditableComplaint {
  id: number;
  text: string;
  incident_date: string | null;
  photos: string[];
  admin_note: string;
  reporter_tg_id?: number;
  reporter_username?: string;
  reporter_name?: string;
  created_at?: string;
  target?: {
    name: string; username: string; role: string; list_type: string; photo_url: string;
    tg_id: number | null; phone?: string; note?: string; bio?: string;
  };
}

const emptyTarget = { name: "", username: "", tg_id: "", phone: "", note: "", photo_url: "", role: "" };

interface Props {
  token: string;
  complaint: EditableComplaint | null;
  onClose: () => void;
  onSaved: () => void;
}

export function ComplaintEditDialog({ token, complaint, onClose, onSaved }: Props) {
  const [text, setText] = useState("");
  const [date, setDate] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [tgt, setTgt] = useState(emptyTarget);
  const avatarRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!complaint) return;
    setText(complaint.text || "");
    setDate(complaint.incident_date ? String(complaint.incident_date).slice(0, 10) : "");
    setPhotos(complaint.photos || []);
    setNote(complaint.admin_note || "");
    const t = complaint.target;
    setTgt(t ? {
      name: t.name || "", username: t.username || "", tg_id: t.tg_id ? String(t.tg_id) : "",
      phone: t.phone || "", note: t.note || "", photo_url: t.photo_url || "", role: t.role || "",
    } : emptyTarget);
  }, [complaint]);

  const uploadOne = async (file: File): Promise<string | null> => {
    const b64 = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    const resp = await fetch(UPLOAD_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Token": token },
      body: JSON.stringify({ file: b64, content_type: file.type }),
    });
    const d = await resp.json();
    return d.ok ? d.url : null;
  };

  const uploadAvatar = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadOne(file);
      if (url) setTgt((t) => ({ ...t, photo_url: url }));
      else toast.error("Не удалось загрузить фото");
    } catch {
      toast.error("Не удалось загрузить фото");
    }
    setUploading(false);
    if (avatarRef.current) avatarRef.current.value = "";
  };

  const setT = (k: keyof typeof emptyTarget) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setTgt((t) => ({ ...t, [k]: e.target.value }));

  const upload = async (files: FileList) => {
    setUploading(true);
    for (const file of Array.from(files).slice(0, 10 - photos.length)) {
      try {
        const b64 = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result));
          r.onerror = rej;
          r.readAsDataURL(file);
        });
        const resp = await fetch(UPLOAD_API, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Admin-Token": token },
          body: JSON.stringify({ file: b64, content_type: file.type }),
        });
        const d = await resp.json();
        if (d.ok) setPhotos((p) => [...p, d.url]);
        else toast.error("Не удалось загрузить фото");
      } catch {
        toast.error("Не удалось загрузить фото");
      }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const save = async () => {
    if (!complaint) return;
    if (text.trim().length < 3) {
      toast.error("Опишите, что произошло");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(COMPLAINTS_API, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify({
          id: complaint.id, edit: true, text, incident_date: date || null, photos, admin_note: note,
          target: complaint.target ? { ...tgt, role: tgt.role || undefined } : undefined,
        }),
      });
      const d = await res.json();
      if (d.ok) {
        toast.success("Жалоба сохранена");
        onSaved();
        onClose();
      } else toast.error(d.error || "Не удалось сохранить");
    } catch {
      toast.error("Не удалось сохранить");
    }
    setSaving(false);
  };

  return (
    <Dialog open={!!complaint} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="space-dialog border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="Pencil" size={16} className="text-red-300" />Жалоба #{complaint?.id}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {complaint?.target && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2.5">
              <div className="text-xs font-medium text-white/70 flex items-center gap-1.5">
                <Icon name="UserRound" fallback="User" size={13} />На кого жалоба
              </div>
              <div className="flex gap-3">
                <button onClick={() => avatarRef.current?.click()} disabled={uploading}
                  className="relative w-20 h-20 rounded-xl overflow-hidden bg-white/5 border border-white/10 shrink-0 group">
                  {tgt.photo_url
                    ? <img src={tgt.photo_url} alt="" className="w-full h-full object-cover" />
                    : <Icon name="User" size={22} className="text-white/30 mx-auto" />}
                  <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-white">
                    Сменить
                  </span>
                </button>
                <input ref={avatarRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
                <div className="flex-1 space-y-2 min-w-0">
                  <input value={tgt.name} onChange={setT("name")} placeholder="Имя" className={inputCls} />
                  <div className="flex gap-1.5">
                    {(["driver", "dispatcher"] as const).map((r) => (
                      <button key={r} onClick={() => setTgt((t) => ({ ...t, role: r }))}
                        className={`flex-1 rounded-lg py-1.5 text-xs border ${tgt.role === r
                          ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200" : "border-white/10 text-white/60 hover:bg-white/5"}`}>
                        {tgt.role === r ? "✓ " : ""}{r === "driver" ? "🚗 Водитель" : "🎧 Диспетчер"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input value={tgt.username} onChange={setT("username")} placeholder="@username" className={inputCls} />
                <input value={tgt.tg_id} onChange={setT("tg_id")} placeholder="Telegram ID" inputMode="numeric" className={inputCls} />
                <input value={tgt.phone} onChange={setT("phone")} placeholder="Телефон" inputMode="tel" className={inputCls} />
              </div>
              <textarea value={tgt.note} onChange={setT("note")} rows={2} placeholder="Комментарий к карточке"
                className={`${inputCls} resize-y`} />
            </div>
          )}

          <label className="block space-y-1">
            <span className="text-xs text-white/50">Что произошло</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className={`${inputCls} resize-y`} />
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-white/50">Когда это было</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </label>

          <div className="space-y-1.5">
            <span className="text-xs text-white/50">Фото ({photos.length}/10)</span>
            <div className="flex flex-wrap gap-2">
              {photos.map((p) => (
                <div key={p} className="relative w-20 h-20 rounded-lg overflow-hidden border border-white/10">
                  <img src={p} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => setPhotos((list) => list.filter((x) => x !== p))}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-red-500">
                    <Icon name="X" size={12} />
                  </button>
                </div>
              ))}
              {photos.length < 10 && (
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="w-20 h-20 rounded-lg border border-dashed border-white/20 text-white/50 hover:text-white hover:border-white/40 flex flex-col items-center justify-center gap-1 text-[10px]">
                  <Icon name={uploading ? "Loader2" : "ImagePlus"} fallback="Plus" size={18} className={uploading ? "animate-spin" : ""} />
                  {uploading ? "Загрузка" : "Добавить"}
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => e.target.files && upload(e.target.files)} />
          </div>

          {complaint && (
            <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-[11px] text-white/50 space-y-0.5">
              <div>
                Пожаловался: <span className="text-sky-300">{complaint.reporter_name || "—"}
                  {complaint.reporter_username ? ` @${complaint.reporter_username}` : ""}</span>
                {complaint.reporter_tg_id ? <span className="font-mono"> · ID {complaint.reporter_tg_id}</span> : null}
              </div>
              {complaint.created_at && <div>Подана: {new Date(complaint.created_at).toLocaleString("ru-RU")}</div>}
            </div>
          )}

          <label className="block space-y-1">
            <span className="text-xs text-white/50">Заметка администратора (видна только в админке)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={`${inputCls} resize-y`} />
          </label>

          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving || uploading}
              className="grad-btn text-white rounded-xl px-4 py-2 text-sm font-medium flex items-center gap-2 disabled:opacity-60">
              <Icon name={saving ? "Loader2" : "Check"} size={15} className={saving ? "animate-spin" : ""} />Сохранить
            </button>
            <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm border border-white/10 text-white/70 hover:bg-white/5">
              Отмена
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ComplaintEditDialog;
