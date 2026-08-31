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
}

export function InviteRunBlock({ state, busy, live, nextIn, canStart, onToggle, onReload }: Props) {
  if (!state) {
    return (
      <div className="rounded-xl bg-white/5 border border-white/10 p-3">
        <p className="text-[11px] text-white/30">Загружаю…</p>
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

      <div className="grid grid-cols-2 gap-1.5 mt-2.5">
        <div className="rounded-lg bg-black/20 px-2 py-1.5">
          <p className="text-[14px] font-semibold text-sky-300">{state.pending.toLocaleString("ru")}</p>
          <p className="text-[10px] text-white/35">в очереди</p>
        </div>
        <div className="rounded-lg bg-black/20 px-2 py-1.5">
          <p className="text-[14px] font-semibold text-emerald-300">{state.capacity_today}</p>
          <p className="text-[10px] text-white/35">можно сегодня</p>
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
