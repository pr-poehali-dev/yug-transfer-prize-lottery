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

type Capacity = { accounts: number; active: number; per_account: number; per_hour: number; used_hour: number };
type ScanState = { running: boolean; done: number; found: number; left: number; note?: string; scope?: string; capacity?: Capacity } | null;

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
  setScanGlobal(d.has ? { running: d.running, done: d.done, found: d.found, left: d.left, note: d.note, scope: d.scope, capacity: d.capacity } : null);
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

  const title = scan?.scope === "refresh" ? "Круглосуточное обновление" : scan?.scope === "full" ? "Полный скан: фото и данные" : "Сканирование базы";
  const waiting = !!scan?.note && /лимит|пауз|жду/i.test(scan.note);
  const cap = scan?.capacity;
  const loadPct = cap?.per_hour ? Math.min(100, (cap.used_hour / cap.per_hour) * 100) : 0;
  const fmt = (n: number) => n.toLocaleString("ru-RU");

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-cyan-500/[0.08] to-white/[0.02] p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="relative w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center bg-cyan-500/15 ring-1 ring-cyan-400/20">
            <Icon name="Radar" fallback="ScanSearch" size={20} className={`text-cyan-300 ${scan?.running && !waiting ? "animate-pulse" : ""}`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-white leading-tight">{title}</div>
            <div className="mt-1.5">
              {scan?.running ? (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${waiting ? "bg-amber-400/15 text-amber-200" : "bg-emerald-400/15 text-emerald-200"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${waiting ? "bg-amber-300" : "bg-emerald-300 animate-pulse"}`} />
                  {waiting ? "Пауза по лимиту" : "Идёт сканирование"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium bg-white/10 text-white/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/40" />Остановлено
                </span>
              )}
            </div>
          </div>
        </div>

        {scan ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              {[
                { l: "Проверено", v: scan.done, c: "text-white" },
                { l: "Найдено", v: scan.found, c: "text-emerald-300" },
                { l: scan.scope === "refresh" ? "В очереди" : "Осталось", v: scan.left, c: "text-cyan-300" },
              ].map((x) => (
                <div key={x.l} className="rounded-xl bg-black/25 border border-white/5 px-3 py-2.5">
                  <div className={`text-lg font-semibold tabular-nums leading-none ${x.c}`}>{fmt(x.v)}</div>
                  <div className="text-[11px] text-white/45 mt-1.5">{x.l}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="flex justify-between text-[11px] text-white/45 mb-1.5">
                <span>Прогресс</span><span className="tabular-nums text-white/70">{pct.toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-300 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
            {scan.note && (
              <div className="flex items-start gap-2 text-xs text-white/60">
                <Icon name="Info" size={14} className="shrink-0 mt-px text-white/40" />{scan.note}
              </div>
            )}
          </>
        ) : (
          <div className="text-xs text-white/50">Обновит имена, фото, описание и ID по всем непроверенным карточкам.</div>
        )}

        {cap?.accounts ? (
          <div className="rounded-xl bg-black/25 border border-white/5 p-3 space-y-2.5">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-sm font-semibold text-white tabular-nums">{cap.active}<span className="text-white/40 font-normal">/{cap.accounts}</span></div>
                <div className="text-[10px] text-white/45 mt-0.5">аккаунтов</div>
              </div>
              <div className="border-x border-white/10">
                <div className="text-sm font-semibold text-white tabular-nums">{cap.per_account}</div>
                <div className="text-[10px] text-white/45 mt-0.5">в час на акк.</div>
              </div>
              <div>
                <div className="text-sm font-semibold text-cyan-300 tabular-nums">{cap.per_hour}</div>
                <div className="text-[10px] text-white/45 mt-0.5">всего в час</div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-white/45 mb-1">
                <span>Лимит часа использован</span><span className="tabular-nums">{cap.used_hour} из {cap.per_hour}</span>
              </div>
              <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                <div className={`h-full rounded-full ${loadPct >= 100 ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${loadPct}%` }} />
              </div>
            </div>
          </div>
        ) : null}

        {scan?.running ? (
          <div className="space-y-2">
            <button onClick={() => run("stop")}
              className="w-full rounded-xl py-2.5 text-sm font-medium border border-red-400/30 text-red-200 bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center gap-2 transition-colors">
              <Icon name="Square" size={14} />Остановить
            </button>
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-cyan-300/70">
              <Icon name="Cloud" size={12} />Работает на сервере 24/7 — сайт можно закрыть
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button onClick={startFull} title="Пройдёт по всем карточкам и подтянет фото, имя, описание и ID"
              className="grad-btn text-white rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-2">
              <Icon name="ImageDown" fallback="Image" size={15} />{scan?.scope === "full" && scan.left ? "Продолжить полный скан" : "Фото и все данные"}
            </button>
            <button onClick={start}
              className="rounded-xl py-2.5 text-sm border border-white/15 text-white/80 hover:bg-white/5 flex items-center justify-center gap-2">
              <Icon name="Play" size={15} />{scan && scan.scope !== "full" && scan.left ? "Продолжить" : "Только новые"}
            </button>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
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
