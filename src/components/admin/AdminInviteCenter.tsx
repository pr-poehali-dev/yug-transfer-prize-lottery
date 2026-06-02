import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { INVITE_RUNNER_URL } from "./adminTypes";
import { useInviteProgress } from "./InviteProgressContext";

interface FullPowerAccount {
  id: number;
  label: string;
  remaining: number;
  used: number;
}

interface WarmupState {
  enabled: boolean;
  start_date: string | null;
  day_num: number;
  accounts_today: number;
  per_account_today: number;
  today: string;
}

interface RunLog {
  id: number;
  account_label: string | null;
  attempted: number;
  added: number;
  privacy: number;
  failed: number;
  ban_triggered: boolean;
  note: string;
  created_at: string;
}

interface CenterStatus {
  target_group: string;
  daily_limit: number;
  pause_range_sec: [number, number];
  max_batch: number;
  active_account: { id: number; label: string; daily_invites_used: number; daily_remaining: number } | null;
  queue: { pending: number; added: number; privacy: number; failed: number };
  recent_runs: RunLog[];
  warmup: WarmupState;
  warmup_schedule: Record<string, [number, number]>;
  full_power_accounts: FullPowerAccount[];
  full_power_total_remaining: number;
}

export function AdminInviteCenter({ token }: { token: string }) {
  const [status, setStatus] = useState<CenterStatus | null>(null);
  const { progress, refreshTrigger } = useInviteProgress();

  const headers = { "Content-Type": "application/json", "X-Admin-Token": token };

  async function load() {
    try {
      const r = await fetch(INVITE_RUNNER_URL, { headers });
      const j = await r.json();
      setStatus(j);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => { load(); }, []);

  // Авто-обновление каждые 5 сек пока идёт инвайт
  useEffect(() => {
    if (!progress?.active) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [progress?.active]);

  // Перезагрузка после завершения активного запуска
  useEffect(() => {
    if (refreshTrigger > 0) load();
  }, [refreshTrigger]);

  if (!status) {
    return <div className="glass rounded-2xl p-5 border border-white/5"><div className="text-center text-xs text-muted-foreground py-6">Загрузка...</div></div>;
  }

  const fpAccs = status.full_power_accounts || [];

  return (
    <div className="glass rounded-2xl p-5 border border-white/5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <Icon name="Zap" size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold">Центр инвайтов</h3>
          <p className="text-xs text-muted-foreground truncate">
            Цель: <span className="font-mono text-white">{status.target_group}</span>
          </p>
        </div>
        <button onClick={load} className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition" title="Обновить">
          <Icon name="RotateCw" size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-white/5 rounded-lg p-2 text-center">
          <div className="text-[10px] text-muted-foreground uppercase">Ожидают</div>
          <div className="text-lg font-bold text-amber-300">{status.queue.pending}</div>
        </div>
        <div className="bg-white/5 rounded-lg p-2 text-center">
          <div className="text-[10px] text-muted-foreground uppercase">Добавлено</div>
          <div className="text-lg font-bold text-green-300">{status.queue.added}</div>
        </div>
        <div className="bg-white/5 rounded-lg p-2 text-center">
          <div className="text-[10px] text-muted-foreground uppercase">Приватность</div>
          <div className="text-lg font-bold text-orange-300">{status.queue.privacy}</div>
        </div>
        <div className="bg-white/5 rounded-lg p-2 text-center">
          <div className="text-[10px] text-muted-foreground uppercase">Ошибки</div>
          <div className="text-lg font-bold text-red-300">{status.queue.failed}</div>
        </div>
      </div>

      <div className="space-y-3">
        {fpAccs.length === 0 ? (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200">
            Нет живых аккаунтов с остатком на сегодня. Подключи аккаунты или дождись утра.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {fpAccs.map(a => (
                <div key={a.id} className="bg-white/[0.03] rounded-lg p-2 border border-white/10">
                  <div className="text-xs font-medium truncate">{a.label}</div>
                  <div className="text-[11px] text-muted-foreground">Сегодня: <b className="text-white">{a.used}</b>/{status.daily_limit}</div>
                  <div className="text-[11px]">Остаток: <b className="text-purple-300">{a.remaining}</b></div>
                </div>
              ))}
            </div>

            <div className="bg-white/[0.03] rounded-xl p-3 text-xs flex items-center justify-between">
              <span className="text-muted-foreground">Всего в пуле остаток на сегодня:</span>
              <span className="font-bold text-purple-300 text-base">{status.full_power_total_remaining}</span>
            </div>

          </>
        )}
      </div>
    </div>
  );
}