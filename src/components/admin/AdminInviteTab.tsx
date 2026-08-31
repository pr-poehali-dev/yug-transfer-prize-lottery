import { useState } from "react";
import Icon from "@/components/ui/icon";

interface AdminInviteTabProps {
  token: string;
  expanded?: boolean;
  onToggle?: () => void;
}

export function AdminInviteTab({ expanded: controlledExpanded, onToggle }: AdminInviteTabProps) {
  const [localExpanded, setLocalExpanded] = useState(false);
  const expanded = controlledExpanded ?? localExpanded;
  const toggleExpanded = onToggle ?? (() => setLocalExpanded(v => !v));

  return (
    <div className="card-glow rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/10"
      >
        <div className="flex items-center gap-2">
          <Icon name="UserPlus" size={15} className="text-emerald-400" />
          <span className="text-sm font-medium text-white">Invite</span>
          <span className="text-[11px] text-white/40">· приглашения в группу</span>
        </div>
        <Icon
          name="ChevronDown"
          size={16}
          className={`text-white/50 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="p-4">
          <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/15 p-3">
            <p className="text-[13px] text-emerald-300 font-medium flex items-center gap-1.5">
              <Icon name="Rocket" size={14} /> Система инвайта — в разработке
            </p>
            <p className="text-[12px] text-white/50 mt-1.5 leading-relaxed">
              Здесь будет приглашение людей в Telegram-группу: список аккаунтов,
              загрузка базы контактов, лимиты в сутки и статистика приглашений.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminInviteTab;
