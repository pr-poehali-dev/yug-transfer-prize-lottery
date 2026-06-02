import Icon from "@/components/ui/icon";
import { TgAccount } from "../adminTypes";

interface AccountRowProps {
  acc: TgAccount;
  busy: boolean;
  onToggleWarmup: (acc: TgAccount) => void;
  onJoinGroupOne: (acc: TgAccount) => void;
  onActivate: (id: number) => void;
  onResetDaily: (id: number) => void;
  onRename: (acc: TgAccount) => void;
  onMarkBanned: (id: number) => void;
  onUnban: (id: number) => void;
  onRemove: (id: number) => void;
  onRunAccount: (acc: TgAccount) => void;
}

export function AccountRow({
  acc,
  busy,
  onToggleWarmup,
  onJoinGroupOne,
  onActivate,
  onResetDaily,
  onRename,
  onMarkBanned,
  onUnban,
  onRemove,
  onRunAccount,
}: AccountRowProps) {
  return (
    <div
      className={`group flex items-center gap-2 px-3 py-2 transition hover:bg-white/[0.02] ${
        acc.is_banned ? "bg-red-500/5" :
        acc.is_active ? "bg-green-500/5" : ""
      }`}
    >
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
        acc.is_banned ? "bg-red-500" :
        acc.is_active ? "bg-green-500 shadow-sm shadow-green-500/50" :
        "bg-muted-foreground/30"
      }`} />

      <span className="text-sm font-medium truncate min-w-0 flex-1">{acc.label}</span>

      <button
        onClick={() => onToggleWarmup(acc)}
        disabled={busy}
        title={acc.needs_warmup ? "🔥 прогрев — клик чтобы перевести на полную мощность" : "⚡ полная мощность — клик чтобы вернуть на прогрев"}
        className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 transition hover:opacity-80 ${
          acc.needs_warmup
            ? "bg-orange-500/20 text-orange-300"
            : "bg-purple-500/20 text-purple-300"
        }`}
      >
        {acc.needs_warmup ? "🔥" : "⚡"}
      </button>

      {!!acc.assigned_count && (
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 shrink-0"
          title={`Назначено кандидатов в очереди: ${acc.assigned_count}`}
        >
          📋 {acc.assigned_count}
        </span>
      )}

      <span className="text-[11px] text-muted-foreground font-mono shrink-0 w-12 text-right" title={`Сегодня инвайтов: ${acc.daily_invites_used} (лимит снят)`}>
        {acc.daily_invites_used}
      </span>

      {acc.is_banned && (
        <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 shrink-0">бан</span>
      )}

      {!acc.is_banned && (
        <button
          onClick={() => onRunAccount(acc)}
          disabled={busy}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white text-[10px] font-semibold shrink-0 hover:opacity-90 transition disabled:opacity-50"
          title="Залить никнеймы в группу с этого аккаунта (до 200 за раз)"
        >
          <Icon name="Send" size={11} />
          Залить
        </button>
      )}

      <div className="flex items-center gap-0.5 shrink-0 opacity-60 group-hover:opacity-100 transition">
        {!acc.is_banned && (
          <button onClick={() => onJoinGroupOne(acc)} disabled={busy}
            className="p-1.5 rounded hover:bg-white/10 text-blue-400 transition" title="Вступить в группу">
            <Icon name="LogIn" size={13} />
          </button>
        )}
        {!acc.is_active && !acc.is_banned && (
          <button onClick={() => onActivate(acc.id)} disabled={busy}
            className="p-1.5 rounded hover:bg-white/10 text-green-400 transition" title="Сделать активным">
            <Icon name="Power" size={13} />
          </button>
        )}
        <button onClick={() => onResetDaily(acc.id)} disabled={busy}
          className="p-1.5 rounded hover:bg-white/10 text-cyan-400 transition" title="Обнулить дневной счётчик">
          <Icon name="RotateCcw" size={13} />
        </button>
        <button onClick={() => onRename(acc)} disabled={busy}
          className="p-1.5 rounded hover:bg-white/10 text-muted-foreground transition" title="Переименовать">
          <Icon name="Pencil" size={13} />
        </button>
        {!acc.is_banned ? (
          <button onClick={() => onMarkBanned(acc.id)} disabled={busy}
            className="p-1.5 rounded hover:bg-white/10 text-amber-400 transition" title="Пометить забаненным">
            <Icon name="Ban" size={13} />
          </button>
        ) : (
          <button onClick={() => onUnban(acc.id)} disabled={busy}
            className="p-1.5 rounded hover:bg-white/10 text-emerald-400 transition" title="Снять бан">
            <Icon name="ShieldCheck" size={13} />
          </button>
        )}
        <button onClick={() => onRemove(acc.id)} disabled={busy}
          className="p-1.5 rounded hover:bg-white/10 text-red-400 transition" title="Удалить">
          <Icon name="Trash2" size={13} />
        </button>
      </div>
    </div>
  );
}

export default AccountRow;