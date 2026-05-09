import { createContext, useContext, useState, ReactNode, useCallback } from "react";

export interface InviteProgress {
  active: boolean;
  title: string;
  subtitle?: string;
  startedAt: number;
  estimatedSec?: number;
  mode: "warmup" | "full_power" | "batch" | "join_group";
}

interface InviteProgressContextValue {
  progress: InviteProgress | null;
  start: (p: Omit<InviteProgress, "active" | "startedAt"> & { startedAt?: number }) => void;
  stop: () => void;
}

const Ctx = createContext<InviteProgressContextValue | null>(null);

export function InviteProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<InviteProgress | null>(null);

  const start = useCallback((p: Omit<InviteProgress, "active" | "startedAt"> & { startedAt?: number }) => {
    setProgress({ ...p, active: true, startedAt: p.startedAt ?? Date.now() });
  }, []);

  const stop = useCallback(() => setProgress(null), []);

  return (
    <Ctx.Provider value={{ progress, start, stop }}>
      {children}
    </Ctx.Provider>
  );
}

export function useInviteProgress() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useInviteProgress must be used inside InviteProgressProvider");
  return v;
}
