import Icon from "@/components/ui/icon";

export interface ScanState {
  running: boolean;
  done: number;
  found: number;
  left: number;
  pausedFor?: string;
  phase?: string;
}

export function ModerationScanProgress({ scan }: { scan: ScanState }) {
  return (
    <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.06] px-4 py-3 space-y-2">
      <div className="flex items-center gap-2 text-sm text-white">
        {scan.running && <Icon name="Loader2" size={14} className="animate-spin text-sky-300" />}
        <span className="truncate">{scan.running ? (scan.phase || "Сканирую Telegram…") : "Сканирование остановлено"}</span>
        <span className="ml-auto text-xs text-white/60 shrink-0">подтянуто {scan.found} · осталось без фото {scan.left}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full bg-sky-400 transition-all"
          style={{ width: `${Math.min(100, (scan.done / Math.max(1, scan.done + scan.left)) * 100)}%` }} />
      </div>
      {scan.pausedFor ? (
        <div className="text-[11px] text-amber-300/90">
          Лимит поиска по @username на аккаунтах исчерпан — освободится через {scan.pausedFor}.
          Сканер продолжит сам в фоне, или нажмите «Подтянуть всё и фото» позже.
        </div>
      ) : (
        <div className="text-[11px] text-white/40">Не закрывайте страницу. Можно остановить и продолжить позже — проверенные не повторяются.</div>
      )}
    </div>
  );
}

export default ModerationScanProgress;
