import { useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { ADMIN_POSTS_URL } from "../adminTypes";

interface BotPostFormProps {
  token: string;
  editingId: number | null;
  form: { photo_url: string; greeting: string; description: string };
  setForm: React.Dispatch<React.SetStateAction<{ photo_url: string; greeting: string; description: string }>>;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export function BotPostForm({ token, editingId, form, setForm, saving, onSave, onCancel }: BotPostFormProps) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch(`${ADMIN_POSTS_URL}?action=upload_photo`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Admin-Token": token },
          body: JSON.stringify({ image: reader.result }),
        });
        const data = await res.json();
        if (data.ok) setForm(f => ({ ...f, photo_url: data.url }));
      } catch { /* */ }
      setUploading(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="mb-6 p-5 rounded-xl border border-purple-500/20 bg-purple-500/5 space-y-4">
      <h4 className="text-white font-medium">{editingId ? "Редактировать пост" : "Новый пост"}</h4>
      <div>
        <label className="text-white/50 text-xs mb-1 block">Фото</label>
        <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
        {form.photo_url ? (
          <div className="flex items-center gap-3">
            <img src={form.photo_url} alt="" className="w-20 h-20 object-cover rounded-xl border border-white/10" />
            <div className="flex flex-col gap-1.5">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 text-xs hover:bg-white/10 transition-colors disabled:opacity-50">
                {uploading ? "Загрузка..." : "Заменить"}
              </button>
              <button type="button" onClick={() => setForm(f => ({ ...f, photo_url: "" }))} className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs hover:bg-red-500/20 transition-colors">
                Удалить
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full py-8 rounded-xl border-2 border-dashed border-white/10 hover:border-purple-500/40 bg-white/[0.02] hover:bg-white/[0.04] transition-all flex flex-col items-center gap-2 disabled:opacity-50">
            {uploading ? (
              <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            ) : (
              <Icon name="ImagePlus" size={28} className="text-white/20" />
            )}
            <span className="text-white/40 text-xs">{uploading ? "Загрузка..." : "Нажмите для загрузки фото"}</span>
          </button>
        )}
      </div>
      <div>
        <label className="text-white/50 text-xs mb-1 block">Заголовок</label>
        <input value={form.greeting} onChange={e => setForm(f => ({ ...f, greeting: e.target.value }))} placeholder="🚕 Нужно такси?" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-purple-500/40" />
      </div>
      <div>
        <label className="text-white/50 text-xs mb-1 block">Описание</label>
        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Комфортные автомобили..." rows={3} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-purple-500/40 resize-none" />
      </div>
      <div className="flex gap-2">
        <button onClick={onSave} disabled={saving || !form.photo_url || !form.greeting || !form.description} className="px-4 py-2 rounded-xl bg-purple-500 text-white text-sm font-medium hover:bg-purple-600 transition-colors disabled:opacity-50">
          {saving ? "Сохранение..." : editingId ? "Сохранить" : "Добавить"}
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-xl bg-white/5 text-white/60 text-sm hover:bg-white/10 transition-colors">
          Отмена
        </button>
      </div>
    </div>
  );
}

export default BotPostForm;
