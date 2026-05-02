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
  button2_text: string;
  button2_url: string;
  status: "draft" | "scheduled" | "published" | "failed";
  scheduled_at: string | null;
}

interface VideoProgress {
  phase: "loading" | "converting" | "encoding";
  percent: number;
}

interface PostFormProps {
  form: PostFormData;
  editId: number | null;
  scheduledAt: string;
  editInTg: boolean;
  saving: boolean;
  publishing: boolean;
  uploading: boolean;
  uploadingVideo: boolean;
  videoProgress: VideoProgress | null;
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
  form, editId, scheduledAt, editInTg, saving, publishing, uploading, uploadingVideo, videoProgress,
  formError, formSuccess, editingPublished,
  onFormChange, onScheduledAtChange, onEditInTgToggle,
  onPhotoUpload, onVideoNoteUpload, onSave, onPublishNow, onReset,
}: PostFormProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const videoCaptureRef = useRef<HTMLInputElement>(null);

  return (
    <div className="card-glow rounded-2xl overflow-hidden">
      {/* Шапка */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
            <Icon name={editId ? "Pencil" : "Plus"} size={12} className="text-white" />
          </div>
          <p className="text-white font-semibold text-sm">{editId ? "Редактировать пост" : "Новый пост"}</p>
        </div>
        {editId && (
          <button onClick={onReset} className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1">
            <Icon name="X" size={12} /> Отмена
          </button>
        )}
      </div>

      <div className="p-3.5 space-y-2.5">

        {/* Название */}
        <div>
          <label className="text-[11px] text-white/50 mb-1 block">Название <span className="text-white/20">(для архива)</span></label>
          <input
            value={form.title}
            onChange={e => onFormChange({ title: e.target.value })}
            placeholder="Название поста..."
            className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-lg px-2.5 py-1.5 text-white text-sm outline-none placeholder-white/20"
          />
        </div>

        {/* Текст */}
        <div>
          <label className="text-[11px] text-white/50 mb-1 flex justify-between">
            <span>Текст поста {!form.video_note_url && <span className="text-red-400">*</span>}</span>
            <span className={form.text.length > 3600 ? "text-red-400" : "text-white/20"}>{form.text.length}/4096</span>
          </label>
          <textarea
            value={form.text}
            onChange={e => onFormChange({ text: e.target.value })}
            placeholder="Текст сообщения... HTML: <b>жирный</b>, <i>курсив</i>, <a href='...'>ссылка</a>"
            rows={4}
            maxLength={4096}
            className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-lg px-2.5 py-2 text-white text-sm outline-none resize-y font-mono leading-snug placeholder-white/20"
          />
        </div>

        {/* Фото + Видео в одну строку на md */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <div>
          <label className="text-[11px] text-white/50 mb-1 block">Фото <span className="text-white/20">(необязательно)</span></label>
          {form.photo_url ? (
            <div className="relative rounded-lg overflow-hidden border border-white/10">
              <img src={form.photo_url} alt="" className="w-full max-h-32 object-cover" />
              <button
                onClick={() => onFormChange({ photo_url: "" })}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center text-white/70 hover:text-white transition-colors"
              >
                <Icon name="X" size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full h-16 rounded-lg border-2 border-dashed border-white/10 hover:border-purple-500/40 flex items-center justify-center gap-2 text-muted-foreground hover:text-white transition-colors"
            >
              {uploading
                ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                : <><Icon name="ImagePlus" size={16} /><span className="text-xs">Загрузить фото</span></>}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoUpload} />
        </div>

        {/* Видео-кружок */}
        <div>
          <label className="text-[11px] text-white/50 mb-1 block">Видео-кружок <span className="text-white/20">(mp4 до 150 МБ)</span></label>
          {form.video_note_url ? (
            <div className="relative flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-2">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-black shrink-0">
                <video src={form.video_note_url} className="w-full h-full object-cover" muted />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-green-400 font-medium">Видео загружено ✓</p>
                <p className="text-[10px] text-white/30 truncate">{form.video_note_url.split('/').pop()}</p>
              </div>
              <button
                onClick={() => onFormChange({ video_note_url: "" })}
                className="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center text-white/60 hover:text-white transition-colors shrink-0"
              >
                <Icon name="X" size={12} />
              </button>
            </div>
          ) : uploadingVideo ? (
            <div className="w-full rounded-lg border-2 border-dashed border-cyan-500/30 flex flex-col items-center justify-center gap-1.5 text-cyan-400 py-3 px-3">
              <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
              <span className="text-[11px] font-medium">
                {videoProgress?.phase === "loading" && "Загрузка..."}
                {videoProgress?.phase === "converting" && `Кружок ${videoProgress.percent}%`}
                {videoProgress?.phase === "encoding" && "На сервер..."}
                {!videoProgress && "Обработка..."}
              </span>
              {videoProgress && videoProgress.phase === "converting" && (
                <div className="w-full max-w-32 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-400 rounded-full transition-all duration-300" style={{ width: `${videoProgress.percent}%` }} />
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => videoCaptureRef.current?.click()}
                className="h-16 rounded-lg border-2 border-dashed border-cyan-500/30 hover:border-cyan-500/70 bg-cyan-500/5 hover:bg-cyan-500/10 flex items-center justify-center gap-1.5 text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <Icon name="Camera" size={15} />
                <span className="text-xs font-medium">Записать</span>
              </button>
              <button
                onClick={() => videoRef.current?.click()}
                className="h-16 rounded-lg border-2 border-dashed border-white/10 hover:border-white/30 flex items-center justify-center gap-1.5 text-white/40 hover:text-white/70 transition-colors"
              >
                <Icon name="FolderOpen" size={15} />
                <span className="text-xs">Файл</span>
              </button>
            </div>
          )}
          <input ref={videoRef} type="file" accept="video/mp4,video/mov,video/avi,video/*" className="hidden" onChange={onVideoNoteUpload} />
          <input ref={videoCaptureRef} type="file" accept="video/*" capture="user" className="hidden" onChange={onVideoNoteUpload} />
        </div>
        </div>

        {/* Кнопки */}
        <div className="space-y-1.5">
          <label className="text-[11px] text-white/50 block">Кнопки <span className="text-white/20">(до 2 шт)</span></label>
          <div className="grid grid-cols-2 gap-1.5">
            <input
              value={form.button_text}
              onChange={e => onFormChange({ button_text: e.target.value })}
              placeholder="Кнопка 1 — текст"
              className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-lg px-2.5 py-1.5 text-white text-sm outline-none placeholder-white/20"
            />
            <input
              value={form.button_url}
              onChange={e => onFormChange({ button_url: e.target.value })}
              placeholder="https://ug-gift.ru"
              className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-lg px-2.5 py-1.5 text-white text-sm outline-none placeholder-white/20"
            />
            <input
              value={form.button2_text}
              onChange={e => onFormChange({ button2_text: e.target.value })}
              placeholder="Кнопка 2 — текст"
              className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-lg px-2.5 py-1.5 text-white text-sm outline-none placeholder-white/20"
            />
            <input
              value={form.button2_url}
              onChange={e => onFormChange({ button2_url: e.target.value })}
              placeholder="https://t.me/..."
              className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-lg px-2.5 py-1.5 text-white text-sm outline-none placeholder-white/20"
            />
          </div>
        </div>

        {/* Расписание */}
        <div className="rounded-xl bg-purple-500/5 border border-purple-500/15 p-2.5 flex items-center gap-2 flex-wrap">
          <p className="text-[11px] text-purple-300 flex items-center gap-1 font-medium shrink-0">
            <Icon name="Calendar" size={12} /> Расписание
          </p>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={e => onScheduledAtChange(e.target.value)}
            className="flex-1 min-w-[180px] bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-lg px-2 py-1.5 text-white text-xs outline-none [color-scheme:dark]"
          />
          {scheduledAt && (
            <span className="text-[11px] text-purple-400 w-full">
              Выйдет {new Date(scheduledAt).toLocaleString("ru", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>

        {/* Тоггл "редактировать в TG" для опубликованных */}
        {editingPublished && (
          <button
            onClick={onEditInTgToggle}
            className={`w-full flex items-center gap-2 p-2 rounded-lg border transition-colors text-left ${editInTg ? "border-orange-500/30 bg-orange-500/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
          >
            <Icon name="Edit3" size={13} className={editInTg ? "text-orange-400" : "text-muted-foreground"} />
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-medium ${editInTg ? "text-orange-300" : "text-white"}`}>Изменить текст в Telegram</p>
              <p className="text-[10px] text-muted-foreground">Обновит уже опубликованное сообщение</p>
            </div>
            <div className={`w-8 h-4 rounded-full transition-colors flex items-center px-0.5 shrink-0 ${editInTg ? "bg-orange-500" : "bg-white/10"}`}>
              <div className={`w-3 h-3 rounded-full bg-white transition-transform ${editInTg ? "translate-x-4" : ""}`} />
            </div>
          </button>
        )}

        {/* Ошибка / успех */}
        {formError && (
          <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-1.5">
            <Icon name="AlertCircle" size={13} /> {formError}
          </div>
        )}
        {formSuccess && (
          <div className="flex items-center gap-2 text-emerald-400 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1.5">
            <Icon name="CheckCircle2" size={13} /> {formSuccess}
          </div>
        )}

        {/* Предпросмотр Telegram */}
        <PostTelegramPreview
          text={form.text}
          photo_url={form.photo_url}
          video_note_url={form.video_note_url}
          button_text={form.button_text}
          button_url={form.button_url}
          button2_text={form.button2_text}
          button2_url={form.button2_url}
        />

        {/* Кнопки действий */}
        <div className="flex gap-1.5 pt-0.5 flex-wrap">
          <button
            onClick={() => onSave("draft")}
            disabled={saving || publishing}
            className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <Icon name="FileText" size={13} />
            {editId ? "Сохранить" : "Черновик"}
          </button>

          {scheduledAt && (
            <button
              onClick={() => onSave("scheduled")}
              disabled={saving || publishing}
              className="flex-1 py-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-xs font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Icon name="Clock" size={13} />
              Запланировать
            </button>
          )}

          <button
            onClick={onPublishNow}
            disabled={saving || publishing}
            className="flex-1 grad-btn py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {publishing
              ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Публикую...</>
              : <><Icon name="Send" size={13} />Опубликовать</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PostForm;