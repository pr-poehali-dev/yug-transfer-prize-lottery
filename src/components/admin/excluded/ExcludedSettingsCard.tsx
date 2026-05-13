import Icon from "@/components/ui/icon";
import type { Settings, ResendItem, ResendQueueStatus } from "./excludedTypes";
import { personalize } from "./excludedTypes";

interface Props {
  settings: Settings | null;
  enabled: boolean;
  saving: boolean;
  template: string;
  setTemplate: (v: string) => void;
  photoUrl: string;
  uploadingPhoto: boolean;
  uploadPhoto: (f: File) => void;
  removePhoto: () => void;
  buttonText: string;
  setButtonText: (v: string) => void;
  buttonUrl: string;
  setButtonUrl: (v: string) => void;
  editingTemplate: boolean;
  setEditingTemplate: (fn: (v: boolean) => boolean) => void;
  togglePower: (on: boolean) => void;
  saveSettings: () => void;
  reviving: boolean;
  reviveLoop: () => void;
  resendQueue: ResendQueueStatus | null;
  scanning: boolean;
  runScan: () => void;
  resending: boolean;
  runResend: () => void;
  resendList: ResendItem[] | null;
  setResendList: (v: ResendItem[] | null) => void;
  runResult: string;
  runFullSweep: () => void;
}

export function ExcludedSettingsCard({
  settings,
  enabled,
  saving,
  template,
  setTemplate,
  photoUrl,
  uploadingPhoto,
  uploadPhoto,
  removePhoto,
  buttonText,
  setButtonText,
  buttonUrl,
  setButtonUrl,
  editingTemplate,
  setEditingTemplate,
  togglePower,
  saveSettings,
  reviving,
  reviveLoop,
  resendQueue,
  scanning,
  runScan,
  resending,
  runResend,
  resendList,
  setResendList,
  runResult,
  runFullSweep,
}: Props) {
  return (
    <div className="rounded-2xl border border-white/8 p-3" style={{ background: "rgba(255,255,255,0.02)" }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
          <Icon name="Settings" size={14} className="text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium text-sm leading-tight">Настройки</h3>
          <p className="text-white/40 text-[10px] leading-tight">Группа @UG_DRIVER · триггер @VsyaRussiabot · {"{name}"} {"{username}"}</p>
        </div>
        <button
          onClick={() => togglePower(!enabled)}
          disabled={saving}
          title={enabled ? "Авто-сообщения включены" : "Авто-сообщения выключены"}
          className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-1.5 transition disabled:opacity-50 ${
            enabled
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25"
              : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
          }`}
        >
          <Icon name={enabled ? "Power" : "PowerOff"} size={12} />
          <span className="hidden sm:inline">{enabled ? "Вкл" : "Выкл"}</span>
          <span className={`relative w-7 h-3.5 rounded-full transition ${enabled ? "bg-emerald-500" : "bg-white/20"}`}>
            <span className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${enabled ? "left-4" : "left-0.5"}`} />
          </span>
        </button>
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="rounded-lg border border-white/10 bg-white/3 overflow-hidden">
            <div className="flex items-start gap-1 px-2.5 py-2">
              <div className="flex-1 min-w-0">
                {!editingTemplate ? (
                  <p className="text-white/80 text-xs whitespace-pre-wrap line-clamp-2">
                    {template?.trim() ? template : <span className="text-white/30">Текст не задан</span>}
                  </p>
                ) : (
                  <textarea
                    value={template} onChange={e => setTemplate(e.target.value)}
                    rows={6} autoFocus
                    className="w-full bg-transparent border-0 text-white text-xs outline-none resize-none font-mono p-0"
                    placeholder="Текст — {name} для имени"
                  />
                )}
              </div>
              <div className="flex gap-0.5 flex-shrink-0">
                <button
                  onClick={() => setEditingTemplate(v => !v)}
                  title={editingTemplate ? "Свернуть" : "Редактировать"}
                  className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center"
                >
                  <Icon name={editingTemplate ? "ChevronUp" : "Pencil"} size={11} className="text-white/60" />
                </button>
                <button
                  onClick={() => { if (confirm("Очистить?")) setTemplate(""); }}
                  title="Очистить"
                  className="w-6 h-6 rounded bg-white/5 hover:bg-red-500/20 flex items-center justify-center"
                >
                  <Icon name="Trash2" size={11} className="text-white/50 hover:text-red-400" />
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/3 p-2">
            <div className="flex items-center gap-2">
              {photoUrl ? (
                <img src={photoUrl} alt="ф" className="w-12 h-12 rounded object-cover border border-white/10 flex-shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded border border-dashed border-white/15 bg-white/3 flex items-center justify-center flex-shrink-0">
                  <Icon name="Image" size={16} className="text-white/30" />
                </div>
              )}
              <div className="flex-1 min-w-0 flex items-center gap-1">
                <label className={`px-2 py-1 rounded bg-white/5 border border-white/10 text-white/80 text-[11px] hover:bg-white/10 cursor-pointer inline-flex items-center gap-1 ${uploadingPhoto ? "opacity-50 pointer-events-none" : ""}`}>
                  <Icon name={uploadingPhoto ? "Loader2" : "Upload"} size={10} className={uploadingPhoto ? "animate-spin" : ""} />
                  {uploadingPhoto ? "..." : photoUrl ? "Заменить фото" : "Загрузить фото"}
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ""; }} />
                </label>
                {photoUrl && (
                  <button onClick={removePhoto} title="Убрать"
                    className="w-6 h-6 rounded bg-white/5 hover:bg-red-500/15 text-red-300 inline-flex items-center justify-center">
                    <Icon name="X" size={11} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/3 p-2">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icon name="MousePointerClick" size={11} className="text-white/60" />
              <span className="text-white/70 text-[11px] font-medium">Кнопка</span>
              {buttonText && buttonUrl && (
                <span className="text-[9px] uppercase font-bold px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-300">вкл</span>
              )}
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              <input
                type="text" value={buttonText} onChange={e => setButtonText(e.target.value)}
                placeholder="Текст («Оплатить»)"
                className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-amber-500/50"
              />
              <input
                type="url" value={buttonUrl} onChange={e => setButtonUrl(e.target.value)}
                placeholder="https://t.me/VsyaRussiabot"
                className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono outline-none focus:border-amber-500/50"
              />
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-1 px-0.5">
            <Icon name="Eye" size={11} className="text-white/50" />
            <span className="text-white/50 text-[10px] font-medium uppercase tracking-wider">Превью</span>
          </div>
          <div className="rounded-xl p-2.5" style={{ background: "#0e1621" }}>
            <div className="flex items-start gap-1.5">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">Я</div>
              <div className="flex-1 min-w-0">
                <div className="inline-block max-w-full rounded-2xl rounded-tl-md overflow-hidden" style={{ background: "#182533" }}>
                  {photoUrl && (
                    <img src={photoUrl} alt="фото" className="block w-full object-cover" style={{ maxHeight: 200, maxWidth: 280 }} />
                  )}
                  <div className="px-2.5 py-1.5">
                    {template?.trim() ? (
                      <p className="text-white text-[12px] leading-snug whitespace-pre-wrap break-words">
                        {personalize(template, "Иван", "ivan")}
                      </p>
                    ) : (
                      <p className="text-white/40 text-[12px] italic">Текст пуст</p>
                    )}
                    {buttonText.trim() && buttonUrl.trim() && (
                      <div className="mt-2 space-y-0.5">
                        <div className="text-white/40 text-[10px] tracking-widest leading-none">━━━━━━━━━━━━━━━</div>
                        <p className="text-center leading-tight">
                          <a href={buttonUrl} target="_blank" rel="noopener noreferrer"
                            style={{ color: "#6ab3f3" }} className="font-extrabold text-[15px] underline">
                            👉 {buttonText.trim().toUpperCase()}
                          </a>
                        </p>
                        <div className="text-white/40 text-[10px] tracking-widest leading-none">━━━━━━━━━━━━━━━</div>
                      </div>
                    )}
                    <div className="text-white/40 text-[9px] text-right mt-0.5">12:34</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <button
          onClick={runFullSweep}
          disabled={scanning || resending || !enabled}
          title={!enabled ? "Сначала включи авто-сообщения" : "Сканировать + отправить всем"}
          className="flex-1 min-w-[180px] px-3 py-2 rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white text-xs font-bold hover:opacity-90 disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
        >
          <Icon name={scanning || resending ? "Loader2" : "Zap"} size={13} className={scanning || resending ? "animate-spin" : ""} />
          {scanning || resending ? "Идёт рассылка…" : "Найти и отправить всем"}
        </button>
        <button onClick={saveSettings} disabled={saving}
          className="px-3 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5">
          <Icon name="Save" size={12} />
          {saving ? "..." : "Сохранить"}
        </button>
        <button onClick={reviveLoop} disabled={reviving || !enabled}
          title={!enabled ? "Сначала включи" : "Перезапустить фоновый цикл"}
          className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 disabled:opacity-40 inline-flex items-center justify-center">
          <Icon name="RefreshCw" size={12} className={reviving ? "animate-spin" : ""} />
        </button>
        {(!resendQueue || resendQueue.queued === 0) ? (
          <button onClick={runScan} disabled={scanning}
            title="Найти всех, кому не дошло"
            className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 disabled:opacity-40 inline-flex items-center justify-center">
            <Icon name="Search" size={12} className={scanning ? "animate-pulse" : ""} />
          </button>
        ) : (
          <>
            <button onClick={runResend} disabled={resending}
              className="px-2.5 py-2 rounded-lg bg-pink-500/15 border border-pink-500/30 text-pink-300 text-xs font-medium hover:bg-pink-500/25 disabled:opacity-40 inline-flex items-center gap-1.5">
              <Icon name="Send" size={12} className={resending ? "animate-pulse" : ""} />
              {resending ? "..." : `Отправить · ${resendQueue.queued}`}
            </button>
            <button onClick={runScan} disabled={scanning} title="Пересканировать"
              className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 inline-flex items-center justify-center">
              <Icon name="RefreshCw" size={12} className={scanning ? "animate-spin" : ""} />
            </button>
          </>
        )}
      </div>
      {runResult && (
        <div className="text-[10px] text-white/50 mt-1.5 px-0.5 line-clamp-2">{runResult}</div>
      )}

      {resendList && resendList.length > 0 && (
        <div className="mt-3 rounded-xl border border-white/8 bg-white/3 overflow-hidden">
          <div className="px-3 py-2 border-b border-white/8 flex items-center justify-between">
            <span className="text-xs text-white/60 inline-flex items-center gap-2">
              <Icon name="Users" size={12} />
              В очереди на отправку: {resendList.filter(r => r.queued).length}
            </span>
            <button onClick={() => setResendList(null)} className="text-white/40 hover:text-white/70">
              <Icon name="X" size={14} />
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto divide-y divide-white/5">
            {resendList.map(r => (
              <div key={r.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                <Icon name={r.queued ? "Clock" : "AlertCircle"} size={12} className={r.queued ? "text-amber-400" : "text-white/30"} />
                <span className="text-white/80 truncate flex-1">
                  {r.first_name || "?"}
                  {r.username && <span className="text-white/40 ml-1">@{r.username}</span>}
                </span>
                {r.send_status && r.send_status !== "ok" && (
                  <span className="text-white/40 text-[10px] truncate max-w-[120px]" title={r.send_status}>{r.send_status}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {resendList && resendList.length === 0 && (
        <div className="mt-3 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs inline-flex items-center gap-2">
          <Icon name="CheckCircle" size={14} />
          Всем уже отправлено — рассылать некому
        </div>
      )}

      {settings?.last_run_at && (
        <p className="text-[11px] text-white/30 mt-2">
          Последняя проверка: {new Date(settings.last_run_at).toLocaleString("ru-RU")}
        </p>
      )}
    </div>
  );
}

export default ExcludedSettingsCard;