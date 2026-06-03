import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

interface DmMessageFormProps {
  text: string;
  setText: (v: string) => void;
  photoUrl: string;
  buttonText: string;
  setButtonText: (v: string) => void;
  buttonUrl: string;
  setButtonUrl: (v: string) => void;
  saving: boolean;
  savedFlash: boolean;
  fileRef: React.RefObject<HTMLInputElement>;
  onPickPhoto: (e: React.ChangeEvent<HTMLInputElement>) => void;
  saveTemplate: () => void;
  removePhoto: () => void;
}

export function DmMessageForm({
  text, setText, photoUrl, buttonText, setButtonText, buttonUrl, setButtonUrl,
  saving, savedFlash, fileRef, onPickPhoto, saveTemplate, removePhoto,
}: DmMessageFormProps) {
  return (
    <div className="glass rounded-xl p-4 border border-white/5 space-y-3">
      <div className="text-xs font-semibold text-muted-foreground">Текст сообщения (общий для всех)</div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={5}
        placeholder="Напиши текст рассылки..."
        className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm resize-y outline-none focus:border-blue-400/50"
      />

      <div className="flex items-center gap-3">
        {photoUrl ? (
          <div className="relative">
            <img src={photoUrl} alt="" className="w-20 h-20 object-cover rounded-lg border border-white/10" />
            <button onClick={removePhoto}
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center">
              <Icon name="X" size={12} />
            </button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} disabled={saving}
            className="w-20 h-20 rounded-lg border border-dashed border-white/20 flex flex-col items-center justify-center text-muted-foreground hover:border-blue-400/50 transition disabled:opacity-50">
            <Icon name="ImagePlus" size={20} />
            <span className="text-[9px] mt-1">Фото</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
        <div className="text-[11px] text-muted-foreground flex-1">Одно фото с подписью.</div>
        <Button onClick={saveTemplate} disabled={saving} size="sm"
          className={`gap-1 shrink-0 ${savedFlash ? "bg-green-600 hover:bg-green-600" : "grad-btn"}`}>
          <Icon name={savedFlash ? "Check" : "Save"} size={14} />
          {saving ? "Сохраняю..." : savedFlash ? "Сохранено" : "Сохранить шаблон"}
        </Button>
      </div>

      {/* Кнопка-ссылка под сообщением */}
      <div className="border-t border-white/5 pt-3 space-y-2">
        <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
          <Icon name="Link" size={12} /> Кнопка-ссылка (необязательно)
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            value={buttonText}
            onChange={e => setButtonText(e.target.value)}
            placeholder="Текст кнопки (напр. Подробнее)"
            className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400/50"
          />
          <input
            value={buttonUrl}
            onChange={e => setButtonUrl(e.target.value)}
            placeholder="https://t.me/..."
            className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400/50"
          />
        </div>
        <div className="text-[10px] text-muted-foreground">Ссылка добавится кликабельной строкой в конце сообщения.</div>
      </div>

      {/* Предпросмотр — как увидит получатель */}
      <div>
        <div className="text-[11px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
          <Icon name="Eye" size={12} /> Предпросмотр
        </div>
        <div className="bg-[#0e1621] rounded-xl p-3 flex justify-start">
          <div className="max-w-[280px] bg-[#182533] rounded-2xl rounded-bl-md overflow-hidden shadow-lg">
            {photoUrl && <img src={photoUrl} alt="" className="w-full max-h-52 object-cover" />}
            <div className="px-3 py-2">
              {text ? (
                <div className="text-[13px] text-white/90 whitespace-pre-wrap break-words leading-snug">{text}</div>
              ) : (
                <div className="text-[13px] text-white/30 italic">Текст сообщения...</div>
              )}
              {buttonText && buttonUrl && (
                <div className="mt-1.5 text-[13px] font-medium text-[#62a8e8] underline break-words">{buttonText}</div>
              )}
              <div className="text-[10px] text-white/40 text-right mt-1">12:00</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DmMessageForm;
