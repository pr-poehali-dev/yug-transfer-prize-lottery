import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import { TG_LOOKUP_API } from "./listTypes";
import { ScanAccounts } from "./ScanAccounts";
import { JunkCleanup } from "./JunkCleanup";

interface Props {
  token: string;
  onChanged: () => void;
}

type ScanState = { running: boolean; done: number; found: number; left: number; note?: string; scope?: string } | null;

let scanState: ScanState = null;
const listeners = new Set<(s: ScanState) => void>();
const setScanGlobal = (v: ScanState) => {
  scanState = v;
  listeners.forEach((l) => l(v));
};

export function useScanState() {
  const [s, set] = useState<ScanState>(scanState);
  useEffect(() => {
    listeners.add(set);
    return () => { listeners.delete(set); };
  }, []);
  return s;
}

async function callBg(token: string, op: "start" | "stop" | "status", scope = "all") {
  const d = await fetch(`${TG_LOOKUP_API}?action=bg_${op}&scope=${scope}`, { headers: { "X-Admin-Token": token } }).then((r) => r.json());
  if (!d.ok) throw new Error(d.error || "сервер не ответил");
  setScanGlobal(d.has ? { running: d.running, done: d.done, found: d.found, left: d.left, note: d.note, scope: d.scope } : null);
  return d;
}

function useBgPolling(token: string, onChanged: () => void) {
  const wasRunning = useRef(false);
  useEffect(() => {
    let alive = true;
    let last = Date.now();
    const tick = async () => {
      try {
        const d = await callBg(token, "status");
        if (!alive) return;
        if (wasRunning.current && !d.running) {
          if (d.finished) toast.success("Глобальное сканирование завершено");
          onChanged();
        } else if (d.running && Date.now() - last > 60000) {
          last = Date.now();
          onChanged();
        }
        wasRunning.current = d.running;
      } catch { /* */ }
    };
    tick();
    const t = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
}

export function GlobalScanBar({ token, onChanged }: Props) {
  const scan = useScanState();
  useBgPolling(token, onChanged);
  const run = async (op: "start" | "stop", scope = "all") => {
    try {
      await callBg(token, op, scope);
      if (op === "start") toast.success("Сканирование запущено на сервере", { description: "Можно закрыть сайт — оно дойдёт до конца само" });
    } catch (e) {
      toast.error(`Не удалось: ${(e as Error).message}`);
    }
  };
  const start = () => run("start", "all");
  const startFull = () => run("start", "full");

  const pct = scan ? Math.min(100, (scan.done / Math.max(1, scan.done + scan.left)) * 100) : 0;

  return (
    <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.05] p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-cyan-500/15">
          <Icon name="Radar" fallback="ScanSearch" size={19} className="text-cyan-300" />
        </div>
        <div className="flex-1 min-w-[180px]">
          <div className="text-sm font-medium text-white">
            {scan?.scope === "full" ? "Полное сканирование: фото и все данные" : "Глобальное сканирование базы"}
          </div>
          <div className="text-xs text-white/50">
            {scan
              ? `проверено ${scan.done} · найдено ${scan.found} · осталось ${scan.left}${scan.note ? ` · ${scan.note}` : ""}`
              : "Обновит имена, фото, описание и ID по всем непроверенным карточкам"}
            {scan?.running && <div className="text-[11px] text-cyan-300/80 mt-0.5">Работает на сервере — можно закрыть сайт, скан дойдёт до конца сам</div>}
          </div>
        </div>
        {scan?.running ? (
          <button onClick={() => run("stop")}
            className="rounded-xl px-4 py-2 text-sm border border-white/15 text-white/80 hover:bg-white/5 flex items-center gap-2">
            <Icon name="Square" size={14} />Стоп
          </button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button onClick={startFull} title="Пройдёт по всем карточкам без фото и подтянет фото, имя, описание и ID"
              className="grad-btn text-white rounded-xl px-4 py-2 text-sm font-medium flex items-center gap-2">
              <Icon name="ImageDown" fallback="Image" size={14} />{scan?.scope === "full" && scan.left ? "Продолжить полный скан" : "Скачать фото и все данные"}
            </button>
            <button onClick={start}
              className="rounded-xl px-4 py-2 text-sm border border-white/15 text-white/80 hover:bg-white/5 flex items-center gap-2">
              <Icon name="Play" size={14} />{scan && scan.scope !== "full" && scan.left ? "Продолжить" : "Только новые"}
            </button>
          </div>
        )}
      </div>
      {scan && (
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-cyan-400 transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
      <div className="border-t border-white/10 pt-2">
        <ScanAccounts token={token} />
      </div>
    </div>
  );
}

export function GlobalScanPage({ token, onChanged, onBack }: Props & { onBack: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm border border-white/10 text-white/70 hover:text-white hover:bg-white/5"
        >
          <Icon name="ArrowLeft" size={14} />Назад
        </button>
        <Icon name="Radar" fallback="ScanSearch" size={18} className="text-cyan-300" />
        <span className="text-base font-medium text-white">Глобальное сканирование</span>
      </div>
      <GlobalScanBar token={token} onChanged={onChanged} />
      <JunkCleanup token={token} onChanged={onChanged} />
    </div>
  );
}
