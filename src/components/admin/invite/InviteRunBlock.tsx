import Icon from "@/components/ui/icon";
import type { InviteRunState } from "../adminTypes";

interface Props {
  state: InviteRunState | null;
  busy: boolean;
  live: boolean;
  nextIn: number;
  canStart: boolean;
  onToggle: () => void;
  onReload: () => void;
  onPace: (pace: string) => void;
  error?: string;
}

export function InviteRunBlock({ state, busy, live, nextIn, canStart, onToggle, onReload, onPace, error }: Props) {
  if (!state) {
    return (
      <div className="rounded-xl bg-white/5 border border-white/10 p-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-white/60 font-medium flex items-center gap-1.5">
            <Icon name="Send" size={12} /> Рассылка приглашений
          </p>
          <button type="button" onClick={onReload} className="text-white/40 hover:text-white">
            <Icon name="RefreshCw" size={13} />
          </button>
        </div>
        <p className={`text-[11px] mt-2 ${error ? "text-amber-300" : "text-white/30"}`}>
          {error || "Загружаю…"}
        </p>
        {!!error && (
          <button type="button" onClick={onReload}
            className="w-full mt-2 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors">
            Повторить
          </button>
        )}
      </div>
    );
  }

  const pct = state.total_planned ? Math.round((state.done / state.total_planned) * 100) : 0;
  const paused = !live && state.is_active;

  return (
    <div className={`rounded-xl border p-3 transition-colors ${
      live ? "bg-emerald-500/10 border-emerald-500/30" : "bg-white/5 border-white/10"
    }`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-white/60 font-medium flex items-center gap-1.5">
          <Icon name="Send" size={12} /> Рассылка приглашений
        </p>
        <button type="button" onClick={onReload} className="text-white/40 hover:text-white">
          <Icon name="RefreshCw" size={13} />
        </button>
      </div>

      <button
        type="button"
        onClick={onToggle}
        disabled={busy || (!live && !paused && !canStart)}
        className={`w-full mt-2.5 py-3 rounded-xl text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${
          live
            ? "bg-red-500/80 hover:bg-red-500 shadow-lg shadow-red-500/20"
            : paused
              ? "bg-amber-500/80 hover:bg-amber-500 shadow-lg shadow-amber-500/20"
              : "bg-emerald-500/85 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20"
        }`}
      >
        <Icon name={live ? "Square" : "Play"} size={15} />
        {busy ? "Секунду…" : live ? "Остановить инвайт" : paused ? "Продолжить инвайт" : "Запустить инвайт"}
      </button>

      <div className="mt-2.5">
        <p className="text-[10px] text-white/40 mb-1.5">Скорость рассылки</p>
        <div className="grid grid-cols-4 gap-1">
          {(state.pace_options || []).map(o => {
            const on = o.key === state.pace;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => onPace(o.key)}
                className={`rounded-lg py-1.5 px-1 text-center transition-colors border ${
                  on
                    ? "bg-emerald-500/20 border-emerald-500/40"
                    : "bg-black/20 border-transparent hover:bg-white/10"
                }`}
              >
                <span className={`block text-[11px] font-medium ${on ? "text-emerald-300" : "text-white/60"}`}>
                  {o.title}
                </span>
                <span className="block text-[9px] text-white/35 leading-tight">{o.per_day}/день</span>
              </button>
            );
          })}
        </div>
        {state.pace === "max" && (
          <p className="text-[10px] text-amber-300/70 mt-1.5">
            Максимум даёт больше приглашений, но выше риск ограничений от Telegram
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5 mt-2.5">
        <div className="rounded-lg bg-black/20 px-2 py-1.5">
          <p className="text-[14px] font-semibold text-sky-300">{state.pending.toLocaleString("ru")}</p>
          <p className="text-[10px] text-white/35">в очереди</p>
        </div>
        <div className="rounded-lg bg-black/20 px-2 py-1.5">
          <p className="text-[14px] font-semibold text-emerald-300">{state.capacity_today}</p>
          <p className="text-[10px] text-white/35">можно сегодня</p>
        </div>
        <div className="rounded-lg bg-black/20 px-2 py-1.5">
          <p className="text-[14px] font-semibold text-white/70">{state.delay_sec}с</p>
          <p className="text-[10px] text-white/35">пауза</p>
        </div>
      </div>

      {state.total_planned > 0 && (
        <div className="mt-2.5">
          <div className="flex items-center justify-between text-[10px] text-white/45 mb-1">
            <span>{state.done} из {state.total_planned}</span>
            <span>+{state.added} · приватность {state.privacy} · ошибки {state.failed}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          {state.last_message && (
            <p className="text-[10px] text-white/40 mt-1.5 truncate">{state.last_message}</p>
          )}
        </div>
      )}

      {live && (
        <p className="text-[10px] text-emerald-300/70 mt-2 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          Следующее приглашение через {nextIn} сек · держите вкладку открытой
        </p>
      )}
      {!live && !state.pending && (
        <p className="text-[10px] text-white/30 mt-2">Очередь пуста — выберите базу с контактами</p>
      )}
      {!live && !!state.pending && !state.capacity_today && (
        <p className="text-[10px] text-amber-300/70 mt-2">Дневные лимиты аккаунтов исчерпаны, продолжим завтра</p>
      )}
    </div>
  );
}

export default InviteRunBlock;