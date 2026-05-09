import Icon from "@/components/ui/icon";
import { AdminAccountsManager } from "./AdminAccountsManager";
import { AdminInviteImport } from "./AdminInviteImport";
import { AdminInviteRunner } from "./AdminInviteRunner";
import { AdminWarmup } from "./AdminWarmup";

export function AdminInvitesTab({ token }: { token: string }) {
  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-5 border border-white/5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Icon name="UserPlus" size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Авто-приглашения в @UG_DRIVER</h2>
            <p className="text-xs text-muted-foreground">Прямой инвайт через user-аккаунты с авто-подменой при бане</p>
          </div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200/90">
          <div className="flex gap-2">
            <Icon name="TriangleAlert" size={14} className="shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold">Важно про лимиты Telegram:</div>
              <ul className="list-disc pl-4 space-y-0.5 opacity-90">
                <li>Не больше 30 инвайтов/сутки на аккаунт — иначе PEER_FLOOD</li>
                <li>Между инвайтами случайная пауза 90–180 секунд</li>
                <li>~50–70% людей вернут «Приватность» — это нормально, едем дальше</li>
                <li>При бане аккаунт авто-помечается, активным становится следующий</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <AdminAccountsManager token={token} />
      <AdminInviteImport token={token} />
      <AdminWarmup token={token} />
      <AdminInviteRunner token={token} />
    </div>
  );
}