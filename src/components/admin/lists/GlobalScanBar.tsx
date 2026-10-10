import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import { TG_LOOKUP_API } from "./listTypes";
import { ScanAccounts } from "./ScanAccounts";

interface Props {
  token: string;
  onChanged: () => void;
}

type ScanState = { running: boolean; done: number; found: number; left: number; note?: string } | null;

let scanState: ScanState = null;
let stopFlag = false;
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

async function runScan(token: string, onChanged: () => void) {
  if (scanState?.running) return;
  stopFlag = false;
  let done = 0, found = 0, idle = 0, left = 0;
  const setScan = setScanGlobal;
  setScan({ running: true, done, found, left });
  while (!stopFlag) {
    try {
      const d = await fetch(`${TG_LOOKUP_API}?action=batch&scope=all`, { headers: { "X-Admin-Token": token } }).then((r) => r.json());
      if (!d.ok) break;
      done += d.done || 0;
      found += d.found || 0;
      left = d.left || 0;
      setScan({ running: true, done, found, left });
      if (!left) break;
      if (!d.done && d.all_paused) {
        const m = Math.ceil((d.resume_in || 0) / 60);
        const when = m >= 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m} мин`;
        setScan({ running: false, done, found, left, note: `Telegram попросил паузу — можно продолжить через ${when}` });
        onChanged();
        return;
      }
      if (!d.done) {
        idle += 1;
        if (idle >= 3) break;
        await new Promise((r) => setTimeout(r, 20000));
      } else idle = 0;
      if (done % 200 < (d.done || 0)) onChanged();
    } catch {
      idle += 1;
      if (idle >= 3) break;
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  setScan({ running: false, done, found, left, note: left ? "Остановлено — можно продолжить" : "База обновлена" });
  if (!left) toast.success("Глобальное сканирование завершено");
  onChanged();
}

export function GlobalScanBar({ token, onChanged }: Props) {
  const scan = useScanState();
  const start = () => runScan(token, onChanged);

  const pct = scan ? Math.min(100, (scan.done / Math.max(1, scan.done + scan.left)) * 100) : 0;

  return (
    <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.05] p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-cyan-500/15">
          <Icon name="Radar" fallback="ScanSearch" size={19} className="text-cyan-300" />
        </div>
        <div className="flex-1 min-w-[180px]">
          <div className="text-sm font-medium text-white">Глобальное сканирование базы</div>
          <div className="text-xs text-white/50">
            {scan
              ? `проверено ${scan.done} · найдено ${scan.found} · осталось ${scan.left}${scan.note ? ` · ${scan.note}` : ""}`
              : "Обновит имена, фото, описание и ID по всем непроверенным карточкам"}
          </div>
        </div>
        {scan?.running ? (
          <button onClick={() => { stopFlag = true; }}
            className="rounded-xl px-4 py-2 text-sm border border-white/15 text-white/80 hover:bg-white/5 flex items-center gap-2">
            <Icon name="Square" size={14} />Стоп
          </button>
        ) : (
          <button onClick={start}
            className="grad-btn text-white rounded-xl px-4 py-2 text-sm font-medium flex items-center gap-2">
            <Icon name="Play" size={14} />{scan ? "Продолжить" : "Запустить"}
          </button>
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
    </div>
  );
}
