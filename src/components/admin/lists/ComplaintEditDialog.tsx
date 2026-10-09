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
}

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
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!complaint) return;
    setText(complaint.text || "");
    setDate(complaint.incident_date ? String(complaint.incident_date).slice(0, 10) : "");
    setPhotos(complaint.photos || []);
    setNote(complaint.admin_note || "");
  }, [complaint]);

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
        body: JSON.stringify({ id: complaint.id, edit: true, text, incident_date: date || null, photos, admin_note: note }),
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
      <DialogContent className="bg-[#14141c] border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="Pencil" size={16} className="text-red-300" />Жалоба #{complaint?.id}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
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
