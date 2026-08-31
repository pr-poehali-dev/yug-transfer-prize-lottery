import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { INVITE_RUN_URL, type InviteRunState } from "../adminTypes";

const TICK_MS = 45000;

export function useInviteRun(token: string, onProgress?: () => void) {
  const [state, setState] = useState<InviteRunState | null>(null);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [nextIn, setNextIn] = useState(0);
  const runningRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const call = useCallback(async (action: string, method: "GET" | "POST" = "POST") => {
    const url = action ? `${INVITE_RUN_URL}?action=${action}` : INVITE_RUN_URL;
    const res = await fetch(url, { method, headers: { "X-Admin-Token": token } });
    return res.json();
  }, [token]);

  const loadState = useCallback(async () => {
    try {
      const d = await call("", "GET");
      if (d.ok) setState(d.state);
    } catch { /* */ }
  }, [call]);

  const setRunning = (v: boolean) => { runningRef.current = v; setLive(v); };

  const scheduleNext = useCallback(() => {
    if (!runningRef.current) return;
    const delay = TICK_MS + Math.floor(Math.random() * 20000);
    setNextIn(Math.round(delay / 1000));
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => { tickRef.current(); }, delay);
  }, []);

  const tick = useCallback(async () => {
    if (!runningRef.current) return;
    try {
      const d = await call("tick");
      if (d.state) setState(d.state);
      if (d.error) toast.warning(d.error);
      onProgress?.();
      if (d.finished || (d.state && !d.state.is_active)) {
        setRunning(false);
        toast.success("Рассылка завершена", { description: d.state?.last_message });
        return;
      }
    } catch {
      toast.error("Нет связи с сервером, пробую снова");
    }
    scheduleNext();
  }, [call, onProgress, scheduleNext]);

  const tickRef = useRef(tick);
  useEffect(() => { tickRef.current = tick; }, [tick]);

  useEffect(() => { loadState(); }, [loadState]);

  useEffect(() => {
    const i = window.setInterval(() => setNextIn(v => (v > 0 ? v - 1 : 0)), 1000);
    return () => {
      window.clearInterval(i);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      runningRef.current = false;
    };
  }, []);

  const start = async () => {
    if (state?.is_active) {
      setRunning(true);
      toast("Продолжаем рассылку");
      tickRef.current();
      return;
    }
    setBusy(true);
    try {
      const d = await call("start");
      if (!d.ok) {
        toast.error(d.error || "Не удалось запустить");
      } else {
        setState(d.state);
        setRunning(true);
        toast.success("Рассылка запущена", {
          description: `План на сегодня: ${d.state.total_planned} приглашений`,
        });
        tickRef.current();
      }
    } catch {
      toast.error("Нет связи с сервером");
    }
    setBusy(false);
  };

  const stop = async () => {
    setRunning(false);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setBusy(true);
    try {
      const d = await call("stop");
      if (d.state) setState(d.state);
      toast("Рассылка остановлена");
    } catch {
      toast.error("Нет связи с сервером");
    }
    setBusy(false);
  };

  const toggle = () => (live ? stop() : start());

  const canStart = !!state && !!state.pending && !!state.capacity_today;

  return { state, busy, live, nextIn, start, stop, toggle, loadState, canStart };
}
