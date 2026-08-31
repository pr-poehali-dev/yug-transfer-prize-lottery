import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import { INVITE_RUN_URL, type InviteRunState } from "../adminTypes";

interface Props {
  token: string;
  onProgress?: () => void;
}

const TICK_MS = 45000;

export function InviteRunBlock({ token, onProgress }: Props) {
  const [state, setState] = useState<InviteRunState | null>(null);
  const [busy, setBusy] = useState(false);
  const [nextIn, setNextIn] = useState(0);
  const runningRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const call = async (action: string, method: "GET" | "POST" = "POST") => {
    const url = action ? `${INVITE_RUN_URL}?action=${action}` : INVITE_RUN_URL;
    const res = await fetch(url, { method, headers: { "X-Admin-Token": token } });
    return res.json();
  };

  const loadState = async () => {
    try {
      const d = await call("", "GET");
      if (d.ok) setState(d.state);
    } catch { /* */ }
  };

  useEffect(() => { loadState(); }, []);

  const tick = async () => {
    if (!runningRef.current) return;
    try {
      const d = await call("tick");
      if (d.state) setState(d.state);
      if (d.error) toast.warning(d.error);
      onProgress?.();
      if (d.finished || (d.state && !d.state.is_active)) {
        runningRef.current = false;
        toast.success("Рассылка завершена", { description: d.state?.last_message });
        return;
      }
    } catch {
      toast.error("Нет связи с сервером, продолжаю позже");
    }
    scheduleNext();
  };

  const scheduleNext = () => {
    if (!runningRef.current) return;
    const delay = TICK_MS + Math.floor(Math.random() * 20000);
    setNextIn(Math.round(delay / 1000));
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(tick, delay);
  };

  useEffect(() => {
    const i = window.setInterval(() => setNextIn(v => (v > 0 ? v - 1 : 0)), 1000);
    return () => {
      window.clearInterval(i);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      runningRef.current = false;
    };
  }, []);

  const handleStart = async () => {
    setBusy(true);
    try {
      const d = await call("start");
      if (!d.ok) {
        toast.error(d.error || "Не удалось запустить");
      } else {
        setState(d.state);
        runningRef.current = true;
        toast.success("Рассылка запущена", {
          description: `План на сегодня: ${d.state.total_planned} приглашений`,
        });
        tick();
      }
    } catch {
      toast.error("Нет связи с сервером");
    }
    setBusy(false);
  };

  const handleStop = async () => {
    runningRef.current = false;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setBusy(true);
    const d = await call("stop");
    if (d.state) setState(d.state);
    setBusy(false);
    toast("Рассылка остановлена");
  };

  const handleResume = () => {
    runningRef.current = true;
    toast("Продолжаем рассылку");
    tick();
  };

  if (!state) {
    return (
      <div className="rounded-xl bg-white/5 border border-white/10 p-3">
        <p className="text-[11px] text-white/30">Загружаю…</p>
      </div>
    );
  }

  const pct = state.total_planned ? Math.round((state.done / state.total_planned) * 100) : 0;
  const live = runningRef.current;

  return (
    <div className={`rounded-xl border p-3 transition-colors ${
      live ? "bg-emerald-500/10 border-emerald-500/30" : "bg-white/5 border-white/10"
    }`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-white/60 font-medium flex items-center gap-1.5">
          <Icon name="Send" size={12} /> Рассылка приглашений
        </p>
        <button type="button" onClick={loadState} className="text-white/40 hover:text-white">
          <Icon name="RefreshCw" size={13} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5 mt-2">
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
            <span>
              приглашено {state.added} · приватность {state.privacy} · ошибки {state.failed}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          {state.last_message && (
            <p className="text-[10px] text-white/40 mt-1.5 truncate">{state.last_message}</p>
          )}
        </div>
      )}

      <div className="flex gap-1.5 mt-2.5">
        {live ? (
          <button type="button" onClick={handleStop} disabled={busy}
            className="flex-1 py-2 rounded-lg bg-red-500/70 hover:bg-red-500 text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5">
            <Icon name="Square" size={12} /> Остановить
          </button>
        ) : state.is_active ? (
          <button type="button" onClick={handleResume}
            className="flex-1 py-2 rounded-lg bg-amber-500/80 hover:bg-amber-500 text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5">
            <Icon name="Play" size={12} /> Продолжить
          </button>
        ) : (
          <button type="button" onClick={handleStart} disabled={busy || !state.pending || !state.capacity_today}
            className="flex-1 py-2 rounded-lg bg-emerald-500/80 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5">
            <Icon name="Play" size={12} /> {busy ? "Запускаю…" : "Запустить рассылку"}
          </button>
        )}
      </div>

      {live && (
        <p className="text-[10px] text-emerald-300/70 mt-1.5 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Следующее приглашение через {nextIn} сек · держите вкладку открытой
        </p>
      )}
      {!live && !state.pending && (
        <p className="text-[10px] text-white/30 mt-1.5">Очередь пуста — выберите базу с контактами</p>
      )}
      {!live && !!state.pending && !state.capacity_today && (
        <p className="text-[10px] text-amber-300/70 mt-1.5">Дневные лимиты аккаунтов исчерпаны, продолжим завтра</p>
      )}
    </div>
  );
}

export default InviteRunBlock;
