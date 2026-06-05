import Icon from "@/components/ui/icon";
import { type Settings, isLoopAlive } from "./excludedTypes";

interface Props {
  tabExpanded: boolean;
  setTabExpanded: (fn?: (v: boolean) => boolean) => void;
  settings: Settings | null;
  enabled: boolean;
}

export function ExcludedTabHeader({ tabExpanded, setTabExpanded, settings, enabled }: Props) {
  return (
    <button
      type="button"
      onClick={() => setTabExpanded(v => !v)}
      className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/10"
    >
      <div className="flex items-center gap-2">
        <Icon name="UserX" size={15} className="text-amber-400" />
        <span className="text-sm font-medium text-white">Авто-сообщения исключённым</span>
        {settings && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/40"}`}>
            {enabled ? "вкл" : "выкл"}
          </span>
        )}
        {settings && enabled && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${isLoopAlive(settings.loop_heartbeat) ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isLoopAlive(settings.loop_heartbeat) ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
            {isLoopAlive(settings.loop_heartbeat) ? "работает" : "цикл остановлен"}
          </span>
        )}
      </div>
      <Icon name="ChevronDown" size={16} className={`text-white/50 transition-transform ${tabExpanded ? "rotate-180" : ""}`} />
    </button>
  );
}

export default ExcludedTabHeader;