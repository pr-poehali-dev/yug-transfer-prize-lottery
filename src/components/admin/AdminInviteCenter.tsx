import { useEffect, useState, useRef } from "react";
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
  const [verifying, setVerifying] = useState(false);
  const [verifyInfo, setVerifyInfo] = useState<{ checked: number; removed: number; remaining: number } | null>(null);
  const stopVerifyRef = useRef(false);
  const { progress, refreshTrigger } = useInviteProgress();

  const headers = { "Content-Type": "application/json", "X-Admin-Token": token };

  async function verifyUsernames() {
    if (verifying) {
      stopVerifyRef.current = true;
      return;
    }
    if (!confirm("Проверить все юзернеймы в очереди на существование? Несуществующие будут убраны. Идёт пачками, можно остановить в любой момент.")) return;
    stopVerifyRef.current = false;
    setVerifying(true);
    let totalChecked = 0;
    let totalRemoved = 0;
    try {
      while (!stopVerifyRef.current) {
        const r = await fetch(`${INVITE_RUNNER_URL}?action=verify_usernames`, {
          method: "POST", headers, body: JSON.stringify({ batch: 60 }),
        });
        const j = await r.json();
        if (!j.ok) { alert(j.error || "Ошибка проверки"); break; }
        totalChecked += j.checked || 0;
        totalRemoved += j.removed || 0;
        setVerifyInfo({ checked: totalChecked, removed: totalRemoved, remaining: j.remaining || 0 });
        await load();
        if (j.done || (j.checked || 0) === 0) {
          const rd = j.redistributed;
          const extra = rd && rd.accounts
            ? `\n\nЖивые юзернеймы (${rd.total}) распределены поровну по ${rd.accounts} аккаунтам.`
            : "";
          alert(`Проверка завершена!\nПроверено: ${totalChecked}\nУдалено битых: ${totalRemoved}${extra}`);
          return;
        }
        await new Promise((res) => setTimeout(res, 800));
      }
      alert(`Проверка остановлена.\nПроверено: ${totalChecked}\nУдалено битых: ${totalRemoved}`);
    } finally {
      setVerifying(false);
      stopVerifyRef.current = false;
    }
  }

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

      <div className="bg-white/[0.03] rounded-xl p-3 border border-white/10 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-medium flex items-center gap-1.5">
              <Icon name="ShieldCheck" size={13} className="text-cyan-400" />
              Проверка юзернеймов
            </div>
            <div className="text-[11px] text-muted-foreground">Убирает несуществующие из очереди</div>
          </div>
          <button
            onClick={verifyUsernames}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition shrink-0 ${
              verifying
                ? "bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30"
                : "bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:opacity-90"
            }`}
          >
            <Icon name={verifying ? "Square" : "ScanSearch"} size={13} />
            {verifying ? "Остановить" : "Проверить все"}
          </button>
        </div>
        {verifyInfo && (
          <div className="text-[11px] text-muted-foreground flex gap-3">
            <span>Проверено: <b className="text-white">{verifyInfo.checked}</b></span>
            <span>Удалено: <b className="text-red-300">{verifyInfo.removed}</b></span>
            <span>Осталось: <b className="text-amber-300">{verifyInfo.remaining}</b></span>
          </div>
        )}
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