import Icon from "@/components/ui/icon";
import { TgAccount } from "../adminTypes";

interface AccountsToolbarProps {
  accounts: TgAccount[];
  busy: boolean;
  targetGroup: string;
  targetEdit: string;
  targetSaving: boolean;
  onTargetEdit: (v: string) => void;
  onCheckTarget: () => void;
  onSaveTarget: () => void;
  onUnbanAll: () => void;
  onResetDailyAll: () => void;
  onDistributeQueue: () => void;
  onJoinGroupAll: () => void;
  onAddAccount: () => void;
  showActions: boolean;
}

export function AccountsToolbar({
  accounts,
  busy,
  targetGroup,
  targetEdit,
  targetSaving,
  onTargetEdit,
  onCheckTarget,
  onSaveTarget,
  onUnbanAll,
  onResetDailyAll,
  onDistributeQueue,
  onJoinGroupAll,
  onAddAccount,
  showActions,
}: AccountsToolbarProps) {
  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
          <Icon name="Users" size={14} />
        </div>
        <h3 className="text-sm font-semibold flex-1">Аккаунты <span className="text-muted-foreground font-normal">({accounts.length})</span></h3>
        {showActions && (
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {accounts.some(a => a.is_banned) && (
              <button
                onClick={onUnbanAll}
                disabled={busy}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] hover:bg-emerald-500/20 transition disabled:opacity-50"
                title="Снять бан со всех аккаунтов"
              >
                <Icon name="ShieldCheck" size={12} />
                Снять баны
              </button>
            )}
            <button
              onClick={onResetDailyAll}
              disabled={busy || accounts.length === 0}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[11px] hover:bg-cyan-500/20 transition disabled:opacity-50"
              title="Обнулить дневные счётчики у всех"
            >
              <Icon name="RotateCcw" size={12} />
              Сброс счётчиков
            </button>
            {accounts.filter(a => !a.is_banned).length > 0 && (
              <button
                onClick={onDistributeQueue}
                disabled={busy}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-[11px] hover:bg-blue-500/20 transition disabled:opacity-50"
                title="Разделить очередь кандидатов поровну между аккаунтами"
              >
                <Icon name="Split" size={12} />
                Разделить поровну
              </button>
            )}
            {accounts.filter(a => !a.is_banned).length > 0 && targetGroup && (
              <button
                onClick={onJoinGroupAll}
                disabled={busy}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] hover:bg-white/10 transition disabled:opacity-50"
                title={`Все аккаунты вступят в ${targetGroup}`}
              >
                <Icon name="LogIn" size={12} />
                Все в группу
              </button>
            )}
            <button
              onClick={onAddAccount}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-[11px] hover:opacity-90 transition"
            >
              <Icon name="Plus" size={13} />
              Подключить
            </button>
          </div>
        )}
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Icon name="Target" size={13} className="text-blue-400 shrink-0" />
        <input
          type="text"
          value={targetEdit}
          onChange={(e) => onTargetEdit(e.target.value)}
          placeholder="@UG_DRIVER или https://t.me/+AbC..."
          title="Целевая группа: @username, t.me/username, или invite-ссылку t.me/+..."
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={onCheckTarget}
          disabled={targetSaving}
          className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition disabled:opacity-40"
          title="Проверить группу"
        >
          <Icon name="Search" size={13} />
        </button>
        <button
          onClick={onSaveTarget}
          disabled={targetSaving || targetEdit.trim() === targetGroup}
          className="px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs hover:bg-blue-500 transition disabled:opacity-40"
          title="Сохранить целевую группу"
        >
          {targetSaving ? "..." : "OK"}
        </button>
      </div>
    </>
  );
}

export default AccountsToolbar;
