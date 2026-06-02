import { createContext, useContext, useState, ReactNode, useCallback, useEffect, useRef } from "react";
import { INVITE_RUNNER_URL } from "./adminTypes";

export interface InviteProgress {
  active: boolean;
  title: string;
  subtitle?: string;
  startedAt: number;
  estimatedSec?: number;
  mode: "warmup" | "full_power" | "batch" | "join_group" | "single_account" | "verify";
  totalPlanned?: number;
  done?: number;
  added?: number;
  privacy?: number;
  failed?: number;
  lastMessage?: string;
}

interface InviteProgressContextValue {
  progress: InviteProgress | null;
  start: (p: Omit<InviteProgress, "active" | "startedAt"> & { startedAt?: number }) => void;
  stop: () => void;
  refreshTrigger: number;
  cancelRun: () => Promise<void>;
}

const Ctx = createContext<InviteProgressContextValue | null>(null);

export function InviteProgressProvider({ children, token }: { children: ReactNode; token?: string }) {
  const [progress, setProgress] = useState<InviteProgress | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const localStartRef = useRef<number>(0);

  const start = useCallback((p: Omit<InviteProgress, "active" | "startedAt"> & { startedAt?: number }) => {
    const startedAt = p.startedAt ?? Date.now();
    localStartRef.current = startedAt;
    setProgress({ ...p, active: true, startedAt });
  }, []);

  const stop = useCallback(() => setProgress(null), []);

  const cancelRun = useCallback(async () => {
    if (!token) return;
    try {
      await fetch(`${INVITE_RUNNER_URL}?action=cancel_run`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: "{}",
      });
      setProgress(null);
      setRefreshTrigger(t => t + 1);
    } catch (e) {
      console.error(e);
    }
  }, [token]);

  // Polling: каждые 5 сек проверяем есть ли активный запуск на сервере
  useEffect(() => {
    if (!token) return;
    let stopped = false;
    const poll = async () => {
      try {
        const r = await fetch(INVITE_RUNNER_URL, {
          headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        });
        const j = await r.json();
        const ar = j.active_run;
        if (stopped) return;
        if (ar?.is_active) {
          const startedAt = ar.started_at
            ? new Date(ar.started_at).getTime()
            : localStartRef.current || Date.now();
          setProgress({
            active: true,
            mode: (ar.mode || "batch") as InviteProgress["mode"],
            title: ar.title || "Идёт инвайт",
            subtitle: ar.subtitle,
            startedAt,
            estimatedSec: ar.estimated_sec || undefined,
            totalPlanned: ar.total_planned,
            done: ar.progress_done,
            added: ar.progress_added,
            privacy: ar.progress_privacy,
            failed: ar.progress_failed,
            lastMessage: ar.last_message,
          });
        } else {
          setProgress(prev => {
            if (prev?.active) setRefreshTrigger(t => t + 1);
            return null;
          });
        }
      } catch (e) {
        console.error("poll err", e);
      }
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => { stopped = true; clearInterval(t); };
  }, [token]);

  return (
    <Ctx.Provider value={{ progress, start, stop, refreshTrigger, cancelRun }}>
      {children}
    </Ctx.Provider>
  );
}

export function useInviteProgress() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useInviteProgress must be used inside InviteProgressProvider");
  return v;
}