import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { useInviteProgress } from "./InviteProgressContext";

const MODE_META: Record<string, { label: string; gradient: string; icon: string }> = {
  warmup:     { label: "Прогрев",         gradient: "from-orange-500 to-amber-500",  icon: "Flame" },
  full_power: { label: "Полная мощность", gradient: "from-purple-500 to-pink-500",   icon: "Zap" },
  batch:      { label: "Инвайт",          gradient: "from-blue-500 to-cyan-500",     icon: "Send" },
  join_group: { label: "Вступление",      gradient: "from-green-500 to-emerald-500", icon: "LogIn" },
};

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s} сек`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function InviteProgressBanner() {
  const { progress } = useInviteProgress();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!progress?.active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [progress?.active]);

  if (!progress?.active) return null;

  const meta = MODE_META[progress.mode] || MODE_META.batch;
  const elapsed = now - progress.startedAt;
  const estMs = (progress.estimatedSec || 0) * 1000;
  const pct = estMs > 0 ? Math.min(100, (elapsed / estMs) * 100) : null;

  return (
    <div className={`w-full bg-gradient-to-r ${meta.gradient} text-white shadow-lg animate-in slide-in-from-top duration-300`}>
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-2.5 flex items-center gap-3">
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-white/30 animate-ping" />
          <div className="relative w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
            <Icon name={meta.icon} size={14} />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold tracking-wider opacity-90">{meta.label}</span>
            <Icon name="Loader2" size={12} className="animate-spin opacity-80" />
            <span className="text-sm font-medium truncate">{progress.title}</span>
          </div>
          {progress.subtitle && (
            <div className="text-[11px] opacity-85 truncate">{progress.subtitle}</div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs font-mono font-bold">{formatElapsed(elapsed)}</div>
          {progress.estimatedSec && (
            <div className="text-[10px] opacity-80">из ~{Math.ceil(progress.estimatedSec / 60)} мин</div>
          )}
        </div>
      </div>
      {pct !== null && (
        <div className="h-0.5 bg-white/20 w-full">
          <div
            className="h-full bg-white transition-all duration-1000"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
