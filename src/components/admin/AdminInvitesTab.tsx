import Icon from "@/components/ui/icon";
import { AdminAccountsManager } from "./AdminAccountsManager";
import { AdminInviteImport } from "./AdminInviteImport";

export function AdminInvitesTab({ token }: { token: string }) {
  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-3 border border-white/5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0">
          <Icon name="UserPlus" size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold">Авто-приглашения</h2>
          <p className="text-[11px] text-muted-foreground">30/сутки на аккаунт · пауза 90-180 сек · авто-подмена при бане</p>
        </div>
        <details className="text-[11px]">
          <summary className="cursor-pointer text-amber-300 hover:text-amber-200">правила</summary>
          <div className="absolute right-4 mt-2 z-10 max-w-xs bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-amber-200/90 text-xs">
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Не больше 30 инвайтов/сутки — иначе PEER_FLOOD</li>
              <li>Между инвайтами 90-180 сек</li>
              <li>50-70% вернут «Приватность» — норма</li>
              <li>При бане аккаунт сам пометится, активным станет следующий</li>
            </ul>
          </div>
        </details>
      </div>

      <AdminAccountsManager token={token} />
      <AdminInviteImport token={token} />
    </div>
  );
}