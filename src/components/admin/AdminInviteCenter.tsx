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

interface AccResult {
  ok: boolean;
  account: string;
  added?: number;
  privacy?: number;
  failed?: number;
  ban_triggered?: boolean;
  ban_note?: string;
  error?: string;
}

export function AdminInviteCenter({ token }: { token: string }) {
  const [status, setStatus] = useState<CenterStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const { start: startProgress, stop: stopProgress, progress, refreshTrigger } = useInviteProgress();

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

  async function runFullPower(size: number) {
    const accs = status?.full_power_accounts?.length || 0;
    if (!accs) {
      alert("Нет живых аккаунтов с остатком на сегодня");
      return;
    }
    const total = accs * size;
    setBusy(true);
    startProgress({
      mode: "full_power",
      title: `Залп ×${size}: ${total} человек`,
      subtitle: `${accs} аккаунтов параллельно`,
      estimatedSec: Math.max(5, size * 2),
    });
    try {
      const r = await fetch(`${INVITE_RUNNER_URL}?action=run_full_power`, {
        method: "POST", headers, body: JSON.stringify({ batch_per_account: size }),
      });
      const j = await r.json();
      if (j.results) {
        const summary = j.results.map((x: AccResult) =>
          `${x.ok ? "✅" : "❌"} ${x.account}: +${x.added || 0}${x.ban_triggered ? " БАН!" : ""}${x.error ? ` — ${x.error}` : ""}`
        ).join("\n");
        alert(`Готово! Добавлено: ${j.total_added || 0}\n\n${summary}`);
      } else if (j.error) {
        alert(`Ошибка: ${j.error}`);
      }
      await load();
    } finally {
      setBusy(false);
      stopProgress();
    }
  }

  if (!status) {
    return <div className="glass rounded-2xl p-5 border border-white/5"><div className="text-center text-xs text-muted-foreground py-6">Загрузка...</div></div>;
  }

  const noQueue = status.queue.pending === 0;
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

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Один клик — один залп со всех аккаунтов:</label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 3, 5, 10].map(n => (
                  <button
                    key={n}
                    onClick={() => runFullPower(n)}
                    disabled={busy || noQueue}
                    className="relative py-3 rounded-lg text-sm font-bold transition border bg-gradient-to-br from-purple-600 to-pink-600 border-purple-400 text-white shadow-lg shadow-purple-500/20 hover:scale-[1.02] hover:shadow-purple-500/40 disabled:opacity-40 disabled:hover:scale-100"
                  >
                    {busy ? (
                      <Icon name="Loader2" size={16} className="animate-spin mx-auto" />
                    ) : (
                      <>
                        <div className="flex items-center justify-center gap-1">
                          <Icon name="Zap" size={13} />
                          <span>×{n}</span>
                        </div>
                        <div className="text-[10px] font-normal opacity-90 mt-0.5">
                          ={fpAccs.length * n} чел
                        </div>
                      </>
                    )}
                    {n === 10 && !busy && (
                      <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-black text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none">МАХ</span>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                ⚡ Без задержек, все аккаунты параллельно. Дневная норма ({fpAccs.length * status.daily_limit} чел) выдаётся за {Math.ceil(status.daily_limit / 10)} нажатий ×10.
              </p>
            </div>

          </>
        )}
      </div>

      {status.recent_runs.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-white">История запусков ({status.recent_runs.length})</summary>
          <div className="mt-2 space-y-1">
            {status.recent_runs.map((log) => (
              <div key={log.id} className="flex items-center gap-2 px-2 py-1.5 bg-white/[0.02] rounded">
                <span className="text-muted-foreground text-[10px] w-32 shrink-0">{new Date(log.created_at).toLocaleString("ru-RU")}</span>
                <span className="truncate flex-1 text-[11px]">{log.account_label || `#${log.id}`}</span>
                <span className="text-green-300">+{log.added}</span>
                <span className="text-orange-300">~{log.privacy}</span>
                <span className="text-red-300">×{log.failed}</span>
                {log.ban_triggered && <Icon name="Ban" size={11} className="text-red-400" />}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}