import Icon from "@/components/ui/icon";
import type { Settings, ResendItem, ResendQueueStatus } from "./excludedTypes";

interface Props {
  settings: Settings | null;
  enabled: boolean;
  saving: boolean;
  template: string;
  setTemplate: (v: string) => void;
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
    <div className="rounded-2xl border border-white/8 p-5" style={{ background: "rgba(255,255,255,0.02)" }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
          <Icon name="Settings" size={20} className="text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium text-lg">Настройки</h3>
          <p className="text-white/40 text-xs">Группа @UG_DRIVER · триггер @VsyaRussiabot · переменные {"{name}"} {"{username}"}</p>
        </div>
      </div>

      <button
        onClick={() => togglePower(!enabled)}
        disabled={saving}
        className={`w-full mb-4 px-4 py-3 rounded-xl border text-sm font-semibold inline-flex items-center justify-between gap-3 transition disabled:opacity-50 ${
          enabled
            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25"
            : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
        }`}
      >
        <span className="inline-flex items-center gap-2">
          <Icon name={enabled ? "Power" : "PowerOff"} size={16} />
          {saving ? "Меняем..." : enabled ? "Авто-сообщения включены" : "Авто-сообщения выключены"}
        </span>
        <span
          className={`relative w-10 h-5 rounded-full transition ${enabled ? "bg-emerald-500" : "bg-white/20"}`}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${enabled ? "left-5" : "left-0.5"}`}
          />
        </span>
      </button>

      <div className="rounded-xl border border-white/10 bg-white/3 overflow-hidden">
        <div className="flex items-start gap-2 px-4 py-3">
          <div className="flex-1 min-w-0">
            {!editingTemplate ? (
              <p className="text-white/80 text-sm whitespace-pre-wrap line-clamp-3">
                {template?.trim() ? template : <span className="text-white/30">Текст не задан</span>}
              </p>
            ) : (
              <textarea
                value={template} onChange={e => setTemplate(e.target.value)}
                rows={10} autoFocus
                className="w-full bg-transparent border-0 text-white text-sm outline-none resize-none font-mono p-0"
                placeholder="Текст сообщения — используй {name} для имени"
              />
            )}
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={() => setEditingTemplate(v => !v)}
              title={editingTemplate ? "Свернуть" : "Редактировать"}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
            >
              <Icon name={editingTemplate ? "ChevronUp" : "Pencil"} size={14} className="text-white/60" />
            </button>
            <button
              onClick={() => { if (confirm("Очистить текст шаблона?")) setTemplate(""); }}
              title="Очистить"
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center"
            >
              <Icon name="Trash2" size={14} className="text-white/50 hover:text-red-400" />
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={runFullSweep}
        disabled={scanning || resending || !enabled}
        title={!enabled ? "Сначала включи авто-сообщения" : "Сканировать admin-лог + обогатить + отправить всем"}
        className="w-full mt-3 px-4 py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white text-sm font-bold hover:opacity-90 disabled:opacity-40 inline-flex items-center justify-center gap-2 shadow-lg shadow-pink-500/20"
      >
        <Icon name={scanning || resending ? "Loader2" : "Zap"} size={16} className={scanning || resending ? "animate-spin" : ""} />
        {scanning || resending ? "Идёт рассылка…" : "Найти и отправить всем за сегодня"}
      </button>

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <button onClick={saveSettings} disabled={saving}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2">
          <Icon name="Save" size={14} />
          {saving ? "Сохранение..." : "Сохранить"}
        </button>
        <button onClick={reviveLoop} disabled={reviving || !enabled}
          title={!enabled ? "Сначала включи авто-сообщения" : "Перезапустить фоновый цикл"}
          className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2">
          <Icon name="RefreshCw" size={14} className={reviving ? "animate-spin" : ""} />
          {reviving ? "Перезапуск..." : "Перезапустить цикл"}
        </button>
        {(!resendQueue || resendQueue.queued === 0) ? (
          <button onClick={runScan} disabled={scanning}
            title="Найти всех, кому не дошло сообщение"
            className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm hover:bg-white/10 disabled:opacity-40 inline-flex items-center gap-2">
            <Icon name="Search" size={14} className={scanning ? "animate-pulse" : ""} />
            {scanning ? "Сканирую..." : "Сканировать"}
          </button>
        ) : (
          <>
            <button onClick={runResend} disabled={resending}
              className="px-3 py-2.5 rounded-xl bg-pink-500/15 border border-pink-500/30 text-pink-300 text-sm font-medium hover:bg-pink-500/25 disabled:opacity-40 inline-flex items-center gap-2">
              <Icon name="Send" size={14} className={resending ? "animate-pulse" : ""} />
              {resending ? "Отправляем..." : `Отправить · ${resendQueue.queued}`}
            </button>
            <button onClick={runScan} disabled={scanning}
              title="Пересканировать"
              className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 inline-flex items-center justify-center">
              <Icon name="RefreshCw" size={14} className={scanning ? "animate-spin" : ""} />
            </button>
          </>
        )}
        {runResult && (
          <span className="text-xs text-white/60 ml-auto">{runResult}</span>
        )}
      </div>

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