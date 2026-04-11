import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import { ADMIN_POSTS_URL } from "./adminTypes";
import type { Post } from "./adminTypes";

interface PostFormModalProps {
  initial?: Post;
  token: string;
  onSave: (post: Post) => void;
  onClose: () => void;
}

function toLocalDatetimeValue(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ""; }
}

export function PostFormModal({ initial, token, onSave, onClose }: PostFormModalProps) {
  const isEdit = !!initial;

  const [title, setTitle] = useState(initial?.title || "");
  const [text, setText] = useState(initial?.text || "");
  const [photoUrl, setPhotoUrl] = useState(initial?.photo_url || "");
  const [buttonText, setButtonText] = useState(initial?.button_text || "");
  const [buttonUrl, setButtonUrl] = useState(initial?.button_url || "");
  const [scheduledAt, setScheduledAt] = useState(toLocalDatetimeValue(initial?.scheduled_at));
  const [editInTg, setEditInTg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const res = await fetch(ADMIN_POSTS_URL + "?action=upload", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Admin-Token": token },
          body: JSON.stringify({ filename: file.name, data: base64, content_type: file.type }),
        });
        const data = await res.json();
        if (data.ok && data.url) setPhotoUrl(data.url);
        else setError(data.error || "Ошибка загрузки");
      } catch { setError("Ошибка загрузки фото"); }
      finally { setUploading(false); }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (saveStatus: "draft" | "scheduled") => {
    if (!text.trim()) { setError("Текст поста обязателен"); return; }
    if (saveStatus === "scheduled" && !scheduledAt) { setError("Укажите дату публикации"); return; }
    setSaving(true); setError("");
    try {
      const payload: Record<string, unknown> = {
        title, text, photo_url: photoUrl,
        button_text: buttonText, button_url: buttonUrl,
        status: saveStatus,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        ...(isEdit ? { id: initial!.id, edit_in_telegram: editInTg } : {}),
      };
      const res = await fetch(ADMIN_POSTS_URL, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Ошибка");
      onSave(data.post);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally { setSaving(false); }
  };

  const charCount = text.length;
  const charLimit = 4096;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-3 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-[#1a1025] rounded-3xl border border-white/10 shadow-2xl flex flex-col max-h-[95vh]">

        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-white/10 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
            <Icon name="Send" size={16} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-white font-semibold text-sm">{isEdit ? "Редактировать пост" : "Новый пост"}</p>
            <p className="text-muted-foreground text-xs">Публикация в Telegram</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors">
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* Title */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Заголовок <span className="text-white/30">(необязательно, только для архива)</span></label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Название поста..."
              className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-3 py-2.5 text-white text-sm outline-none"
            />
          </div>

          {/* Text */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 flex items-center justify-between">
              <span>Текст поста <span className="text-red-400">*</span></span>
              <span className={charCount > charLimit * 0.9 ? "text-red-400" : "text-white/30"}>{charCount}/{charLimit}</span>
            </label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Текст сообщения. Поддерживается HTML: <b>жирный</b>, <i>курсив</i>, <a href='...'>ссылка</a>"
              rows={7}
              maxLength={charLimit}
              className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-3 py-2.5 text-white text-sm outline-none resize-none font-mono"
            />
            <p className="text-xs text-muted-foreground mt-1">HTML теги: &lt;b&gt; жирный &lt;/b&gt;, &lt;i&gt; курсив &lt;/i&gt;, &lt;a href=&quot;url&quot;&gt; ссылка &lt;/a&gt;</p>
          </div>

          {/* Photo */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Фото <span className="text-white/30">(необязательно)</span></label>
            <div className="flex gap-2">
              <input
                value={photoUrl}
                onChange={e => setPhotoUrl(e.target.value)}
                placeholder="https://... или загрузить"
                className="flex-1 bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-3 py-2.5 text-white text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white text-sm border border-white/10 transition-colors disabled:opacity-50 shrink-0"
              >
                {uploading ? <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" /> : <Icon name="Upload" size={15} />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </div>
            {photoUrl && (
              <div className="mt-2 relative w-full max-h-40 overflow-hidden rounded-xl border border-white/10">
                <img src={photoUrl} alt="preview" className="w-full object-cover max-h-40" />
                <button
                  onClick={() => setPhotoUrl("")}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white/70 hover:text-white"
                >
                  <Icon name="X" size={12} />
                </button>
              </div>
            )}
          </div>

          {/* Button */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Кнопка — текст</label>
              <input
                value={buttonText}
                onChange={e => setButtonText(e.target.value)}
                placeholder="Участвовать →"
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-3 py-2.5 text-white text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Кнопка — ссылка</label>
              <input
                value={buttonUrl}
                onChange={e => setButtonUrl(e.target.value)}
                placeholder="https://ug-gift.ru"
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-3 py-2.5 text-white text-sm outline-none"
              />
            </div>
          </div>

          {/* Schedule */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <p className="text-white text-sm font-medium flex items-center gap-2">
              <Icon name="Calendar" size={15} className="text-purple-400" />
              Расписание публикации
            </p>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Дата и время публикации</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-3 py-2.5 text-white text-sm outline-none [color-scheme:dark]"
              />
              {scheduledAt && (
                <p className="text-xs text-purple-400 mt-1">
                  Пост будет опубликован автоматически {new Date(scheduledAt).toLocaleString("ru")}
                </p>
              )}
              {scheduledAt && (
                <button onClick={() => setScheduledAt("")} className="text-xs text-muted-foreground hover:text-white mt-1 transition-colors">
                  × Убрать расписание (сохранить как черновик)
                </button>
              )}
            </div>
          </div>

          {/* Edit in Telegram toggle (only for published posts) */}
          {isEdit && initial?.status === "published" && initial?.telegram_message_id && (
            <div
              onClick={() => setEditInTg(v => !v)}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${editInTg ? "border-orange-500/40 bg-orange-500/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${editInTg ? "bg-orange-500/20 text-orange-400" : "bg-white/5 text-muted-foreground"}`}>
                <Icon name="Edit3" size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${editInTg ? "text-orange-300" : "text-white"}`}>Редактировать в Telegram</p>
                <p className="text-xs text-muted-foreground">Изменить текст уже опубликованного сообщения</p>
              </div>
              <div className={`w-10 h-5 rounded-full transition-colors ${editInTg ? "bg-orange-500" : "bg-white/10"} flex items-center px-0.5`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${editInTg ? "translate-x-5" : "translate-x-0"}`} />
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              <Icon name="AlertCircle" size={14} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 pt-0 border-t border-white/5 shrink-0">
          <div className="flex gap-2 flex-wrap">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white text-sm font-medium transition-colors">
              Отмена
            </button>
            <button
              onClick={() => handleSave("draft")}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Icon name="FileText" size={14} />
              {isEdit ? "Сохранить" : "Черновик"}
            </button>
            <button
              onClick={() => handleSave("scheduled")}
              disabled={saving || !scheduledAt}
              className="px-4 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-sm font-medium transition-colors disabled:opacity-40 flex items-center gap-2"
            >
              <Icon name="Clock" size={14} />
              Запланировать
            </button>
            <div className="flex-1" />
            {saving && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm px-2">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Сохраняем...
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default PostFormModal;
