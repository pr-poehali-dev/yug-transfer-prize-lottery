import { useState } from "react";
import Icon from "@/components/ui/icon";
import { AdminAccountsManager } from "./AdminAccountsManager";
import { AdminInviteImport } from "./AdminInviteImport";

export function AdminInvitesTab({ token }: { token: string }) {
  const [dailyLimit, setDailyLimit] = useState(15);

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-5 border border-white/5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Icon name="UserPlus" size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Авто-приглашения в @UG_DRIVE</h2>
            <p className="text-xs text-muted-foreground">Массовое добавление участников из спарсенного списка</p>
          </div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200/90">
          <div className="flex gap-2">
            <Icon name="TriangleAlert" size={14} className="shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold">Важно про лимиты Telegram:</div>
              <ul className="list-disc pl-4 space-y-0.5 opacity-90">
                <li>Не больше 15-20 добавлений в день — иначе бан user-аккаунта на неделю</li>
                <li>~60-70% людей вернут отказ (USER_PRIVACY_RESTRICTED) — им отправим ссылку через бота</li>
                <li>При бане одного аккаунта — переключайся на запасной из списка ниже</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <AdminAccountsManager token={token} />

      <AdminInviteImport token={token} />

      <div className="glass rounded-2xl p-5 border border-white/5">
        <h3 className="text-sm font-semibold mb-3">Настройки добавления</h3>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">Лимит добавлений в день (на каждый аккаунт)</label>
            <input
              type="number"
              min={1}
              max={30}
              value={dailyLimit}
              onChange={(e) => setDailyLimit(Math.max(1, Math.min(30, parseInt(e.target.value) || 15)))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
            />
          </div>
          <button
            disabled
            className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-muted-foreground cursor-not-allowed"
          >
            Сохранить
          </button>
        </div>
      </div>

      <div className="glass rounded-2xl p-5 border border-white/5">
        <h3 className="text-sm font-semibold mb-3">Действия</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            disabled
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600/30 to-pink-600/30 border border-purple-500/30 text-sm text-muted-foreground cursor-not-allowed"
          >
            <Icon name="UserPlus" size={16} />
            Добавить {dailyLimit} человек сейчас
          </button>
          <button
            disabled
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/10 text-sm text-muted-foreground cursor-not-allowed"
          >
            <Icon name="Send" size={16} />
            Разослать ссылки отказникам
          </button>
        </div>
        <div className="mt-3 text-xs text-muted-foreground text-center">
          Логика добавления подключим следующим шагом
        </div>
      </div>
    </div>
  );
}
