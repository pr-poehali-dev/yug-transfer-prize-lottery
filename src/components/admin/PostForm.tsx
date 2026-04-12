import { useRef } from "react";
import Icon from "@/components/ui/icon";
import { PostTelegramPreview } from "./PostTelegramPreview";

export interface PostFormData {
  title: string;
  text: string;
  photo_url: string;
  video_note_url: string;
  button_text: string;
  button_url: string;
  status: "draft" | "scheduled" | "published" | "failed";
  scheduled_at: string | null;
  chat: "main" | "kurilka";
}

const CHATS = [
  { value: "main",    label: "ЮГ ТРАНСФЕР",  sub: "@ug_transfer_gift" },
  { value: "kurilka", label: "КУРИЛКА",       sub: "@KURILKA_GIFT" },
] as const;

interface PostFormProps {
  form: PostFormData;
  editId: number | null;
  scheduledAt: string;
  editInTg: boolean;
  saving: boolean;
  publishing: boolean;
  uploading: boolean;
  uploadingVideo: boolean;
  formError: string;
  formSuccess: string;
  editingPublished: boolean;
  onFormChange: (patch: Partial<PostFormData>) => void;
  onScheduledAtChange: (v: string) => void;
  onEditInTgToggle: () => void;
  onPhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onVideoNoteUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSave: (status: "draft" | "scheduled") => void;
  onPublishNow: () => void;
  onReset: () => void;
}

export function PostForm({
  form, editId, scheduledAt, editInTg, saving, publishing, uploading, uploadingVideo,
  formError, formSuccess, editingPublished,
  onFormChange, onScheduledAtChange, onEditInTgToggle,
  onPhotoUpload, onVideoNoteUpload, onSave, onPublishNow, onReset,
}: PostFormProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const videoCaptureRef = useRef<HTMLInputElement>(null);

  return (
    <div className="card-glow rounded-3xl overflow-hidden">
      {/* Шапка */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
            <Icon name={editId ? "Pencil" : "Plus"} size={15} className="text-white" />
          </div>
          <p className="text-white font-semibold text-sm">{editId ? "Редактировать пост" : "Новый пост"}</p>
        </div>
        {editId && (
          <button onClick={onReset} className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1">
            <Icon name="X" size={13} /> Отмена
          </button>
        )}
      </div>

      <div className="p-5 space-y-4">

        {/* Выбор чата */}
        <div>
          <label className="text-xs text-white/50 mb-1.5 block">Канал публикации</label>
          <div className="grid grid-cols-2 gap-2">
            {CHATS.map(ch => (
              <button
                key={ch.value}
                type="button"
                onClick={() => onFormChange({ chat: ch.value })}
                className={`flex flex-col items-start px-3 py-2.5 rounded-xl border text-left transition-all ${
                  form.chat === ch.value
                    ? "border-blue-500/60 bg-blue-500/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <span className={`text-sm font-semibold ${form.chat === ch.value ? "text-blue-300" : "text-white"}`}>
                  {ch.label}
                </span>
                <span className="text-xs text-white/30">{ch.sub}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Название */}
        <div>
          <label className="text-xs text-white/50 mb-1.5 block">Название <span className="text-white/20">(для архива)</span></label>
          <input
            value={form.title}
            onChange={e => onFormChange({ title: e.target.value })}
            placeholder="Название поста..."
            className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none placeholder-white/20"
          />
        </div>

        {/* Текст */}
        <div>
          <label className="text-xs text-white/50 mb-1.5 flex justify-between">
            <span>Текст поста <span className="text-red-400">*</span></span>
            <span className={form.text.length > 3600 ? "text-red-400" : "text-white/20"}>{form.text.length}/4096</span>
          </label>
          <textarea
            value={form.text}
            onChange={e => onFormChange({ text: e.target.value })}
            placeholder={"Текст сообщения...\n\nПоддерживается HTML:\n<b>жирный</b>, <i>курсив</i>\n<a href='https://...'>ссылка</a>"}
            rows={6}
            maxLength={4096}
            className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none resize-none font-mono leading-relaxed placeholder-white/20"
          />
        </div>

        {/* Фото */}
        <div>
          <label className="text-xs text-white/50 mb-1.5 block">Фото <span className="text-white/20">(необязательно)</span></label>
          {form.photo_url ? (
            <div className="relative rounded-xl overflow-hidden border border-white/10">
              <img src={form.photo_url} alt="" className="w-full max-h-44 object-cover" />
              <button
                onClick={() => onFormChange({ photo_url: "" })}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center text-white/70 hover:text-white transition-colors"
              >
                <Icon name="X" size={13} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full h-24 rounded-xl border-2 border-dashed border-white/10 hover:border-purple-500/40 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-white transition-colors"
            >
              {uploading
                ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                : <><Icon name="ImagePlus" size={20} /><span className="text-xs">Загрузить фото</span></>}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoUpload} />
        </div>

        {/* Видео-кружок */}
        <div>
          <label className="text-xs text-white/50 mb-1.5 block">Видео-кружок <span className="text-white/20">(необязательно, mp4 до 60 сек)</span></label>
          {form.video_note_url ? (
            <div className="relative flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-black shrink-0">
                <video src={form.video_note_url} className="w-full h-full object-cover" muted />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-green-400 font-medium">Видео загружено ✓</p>
                <p className="text-xs text-white/30 truncate">{form.video_note_url.split('/').pop()}</p>
              </div>
              <button
                onClick={() => onFormChange({ video_note_url: "" })}
                className="w-7 h-7 rounded-full bg-black/50 flex items-center justify-center text-white/60 hover:text-white transition-colors shrink-0"
              >
                <Icon name="X" size={13} />
              </button>
            </div>
          ) : uploadingVideo ? (
            <div className="w-full h-24 rounded-xl border-2 border-dashed border-cyan-500/30 flex flex-col items-center justify-center gap-2 text-cyan-400">
              <div className="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
              <span className="text-xs">Загружаю видео...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => videoCaptureRef.current?.click()}
                className="h-24 rounded-xl border-2 border-dashed border-cyan-500/30 hover:border-cyan-500/70 bg-cyan-500/5 hover:bg-cyan-500/10 flex flex-col items-center justify-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <Icon name="Camera" size={22} />
                <span className="text-xs font-medium">Записать видео</span>
              </button>
              <button
                onClick={() => videoRef.current?.click()}
                className="h-24 rounded-xl border-2 border-dashed border-white/10 hover:border-white/30 flex flex-col items-center justify-center gap-2 text-white/40 hover:text-white/70 transition-colors"
              >
                <Icon name="FolderOpen" size={22} />
                <span className="text-xs">Выбрать файл</span>
              </button>
            </div>
          )}
          <input ref={videoRef} type="file" accept="video/mp4,video/mov,video/avi,video/*" className="hidden" onChange={onVideoNoteUpload} />
          <input ref={videoCaptureRef} type="file" accept="video/*" capture="user" className="hidden" onChange={onVideoNoteUpload} />
        </div>

        {/* Кнопка */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">Кнопка — текст</label>
            <input
              value={form.button_text}
              onChange={e => onFormChange({ button_text: e.target.value })}
              placeholder="Подробнее →"
              className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none placeholder-white/20"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">Кнопка — ссылка</label>
            <input
              value={form.button_url}
              onChange={e => onFormChange({ button_url: e.target.value })}
              placeholder="https://ug-gift.ru"
              className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none placeholder-white/20"
            />
          </div>
        </div>

        {/* Расписание */}
        <div className="rounded-2xl bg-purple-500/5 border border-purple-500/15 p-4 space-y-2">
          <p className="text-xs text-purple-300 flex items-center gap-1.5 font-medium">
            <Icon name="Calendar" size={13} /> Расписание публикации
          </p>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={e => onScheduledAtChange(e.target.value)}
            className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none [color-scheme:dark]"
          />
          {scheduledAt && (
            <p className="text-xs text-purple-400">
              Пост выйдет {new Date(scheduledAt).toLocaleString("ru", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>

        {/* Тоггл "редактировать в TG" для опубликованных */}
        {editingPublished && (
          <button
            onClick={onEditInTgToggle}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${editInTg ? "border-orange-500/30 bg-orange-500/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
          >
            <Icon name="Edit3" size={15} className={editInTg ? "text-orange-400" : "text-muted-foreground"} />
            <div className="flex-1">
              <p className={`text-sm font-medium ${editInTg ? "text-orange-300" : "text-white"}`}>Изменить текст в Telegram</p>
              <p className="text-xs text-muted-foreground">Отредактирует уже опубликованное сообщение</p>
            </div>
            <div className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 shrink-0 ${editInTg ? "bg-orange-500" : "bg-white/10"}`}>
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${editInTg ? "translate-x-4" : ""}`} />
            </div>
          </button>
        )}

        {/* Ошибка / успех */}
        {formError && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
            <Icon name="AlertCircle" size={14} /> {formError}
          </div>
        )}
        {formSuccess && (
          <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5">
            <Icon name="CheckCircle2" size={14} /> {formSuccess}
          </div>
        )}

        {/* Предпросмотр Telegram */}
        <PostTelegramPreview
          text={form.text}
          photo_url={form.photo_url}
          video_note_url={form.video_note_url}
          button_text={form.button_text}
          button_url={form.button_url}
        />

        {/* Кнопки действий */}
        <div className="flex gap-2 pt-1 flex-wrap">
          <button
            onClick={() => onSave("draft")}
            disabled={saving || publishing}
            className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Icon name="FileText" size={14} />
            {editId ? "Сохранить" : "Черновик"}
          </button>

          {scheduledAt && (
            <button
              onClick={() => onSave("scheduled")}
              disabled={saving || publishing}
              className="flex-1 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Icon name="Clock" size={14} />
              Запланировать
            </button>
          )}

          <button
            onClick={onPublishNow}
            disabled={saving || publishing}
            className="flex-1 grad-btn py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {publishing
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Публикую...</>
              : <><Icon name="Send" size={14} />Опубликовать</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PostForm;