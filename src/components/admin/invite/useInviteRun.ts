import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { INVITE_RUN_URL, type InviteRunState } from "../adminTypes";

const BATCH_BY_PACE: Record<string, number> = { safe: 1, normal: 2, fast: 3, max: 5 };

export function useInviteRun(token: string, onProgress?: () => void) {
  const [state, setState] = useState<InviteRunState | null>(null);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [nextIn, setNextIn] = useState(0);
  const runningRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const paceRef = useRef("safe");

  const call = useCallback(async (action: string, method: "GET" | "POST" = "POST", body?: unknown) => {
    const url = action ? `${INVITE_RUN_URL}?action=${action}` : INVITE_RUN_URL;
    const res = await fetch(url, {
      method,
      headers: { "X-Admin-Token": token, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return res.json();
  }, [token]);

  const apply = (s: InviteRunState | undefined) => {
    if (!s) return;
    setState(s);
    if (s.pace) paceRef.current = s.pace;
  };

  const [error, setError] = useState("");

  const loadState = useCallback(async () => {
    try {
      const d = await call("", "GET");
      if (d.ok) { apply(d.state); setError(""); }
      else setError(d.error || "Нет доступа к рассылке");
    } catch {
      setError("Нет связи с сервером");
    }
  }, [call]);

  const [checking, setChecking] = useState(false);
  const [checkRows, setCheckRows] = useState<
    { label: string; status: string; text: string }[] | null
  >(null);

  const checkAccounts = useCallback(async () => {
    setChecking(true);
    setCheckRows([]);
    const rows: { label: string; status: string; text: string }[] = [];
    try {
      for (let i = 0; i < 30; i++) {
        const d = await call(`check&i=${i}`);
        if (!d.ok) { toast.error(d.error || "Не удалось проверить"); break; }
        if (d.account) {
          rows.push(d.account);
          setCheckRows([...rows]);
        }
        if (d.done) break;
      }
      if (rows.length) {
        const bad = rows.filter(a => a.status !== "ok" && a.status !== "joined");
        toast[bad.length ? "warning" : "success"](
          bad.length ? `Проблемных аккаунтов: ${bad.length}` : "Все аккаунты в группе",
        );
      }
    } catch {
      toast.error("Нет связи с сервером");
    } finally {
      setChecking(false);
    }
  }, [call]);

  const [joining, setJoining] = useState<number | null>(null);
  const [joined, setJoined] = useState<Record<number, string>>({});

  const joinGroup = useCallback(async (accId: number) => {
    setJoining(accId);
    try {
      let d: { ok?: boolean; text?: string; error?: string } = {};
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          d = await call(`join&id=${accId}`);
        } catch {
          d = { ok: false, error: "timeout" };
        }
        if (d.ok) break;
        const e = (d.error || "").toLowerCase();
        const retriable = !e || e.includes("timeout") || e.includes("connect")
          || e.includes("disconnect") || e.includes("подключ");
        if (!retriable) break;
        setJoined(p => ({ ...p, [accId]: `попытка ${attempt + 2}…` }));
        await new Promise(r => setTimeout(r, 1200));
      }
      if (d.ok) {
        setJoined(p => ({ ...p, [accId]: d.text || "в группе" }));
        toast.success(d.text === "уже в группе" ? "Уже в группе" : "Вступил в группу");
      } else {
        setJoined(p => ({ ...p, [accId]: d.error || "ошибка" }));
        toast.error(d.error || "Не удалось вступить");
      }
    } catch {
      toast.error("Нет связи с сервером");
    } finally {
      setJoining(null);
    }
  }, [call]);

  const setRunning = (v: boolean) => { runningRef.current = v; setLive(v); };

  const delayRef = useRef(60);

  const scheduleNext = useCallback(() => {
    if (!runningRef.current) return;
    const base = delayRef.current * 1000;
    const delay = base + Math.floor(Math.random() * base * 0.4);
    setNextIn(Math.round(delay / 1000));
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => { tickRef.current(); }, delay);
  }, []);

  const tick = useCallback(async () => {
    if (!runningRef.current) return;
    try {
      const size = BATCH_BY_PACE[paceRef.current] || 1;
      const d = await call(`tick&size=${size}`);
      if (d.state) {
        apply(d.state);
        delayRef.current = d.state.delay_sec || 60;
      }
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
        apply(d.state);
        delayRef.current = d.state.delay_sec || 60;
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

  const changePace = async (pace: string) => {
    paceRef.current = pace;
    setState(s => (s ? { ...s, pace } : s));
    try {
      const d = await call("set_pace", "POST", { pace });
      if (d.state) {
        apply(d.state);
        delayRef.current = d.state.delay_sec || 60;
        const opt = d.state.pace_options?.find((o: { key: string }) => o.key === pace);
        toast.success(`Темп: ${opt?.title || pace}`, {
          description: opt ? `до ${opt.per_day} приглашений в день` : undefined,
        });
      }
    } catch {
      toast.error("Не удалось сменить темп");
    }
  };

  const canStart = !!state && !!state.pending && !!state.capacity_today;

  return { state, busy, live, nextIn, start, stop, toggle, loadState, canStart, changePace, error, checkAccounts, checking, checkRows, joinGroup, joining, joined };
}