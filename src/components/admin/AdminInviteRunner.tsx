import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { INVITE_RUNNER_URL } from "./adminTypes";

interface WarmupState {
  enabled: boolean;
  start_date: string | null;
  day_num: number;
  accounts_today: number;
  per_account_today: number;
  today: string;
}

interface RunnerStatus {
  target_group: string;
  daily_limit: number;
  pause_range_sec: [number, number];
  max_batch: number;
  active_account: {
    id: number;
    label: string;
    daily_invites_used: number;
    daily_remaining: number;
  } | null;
  queue: { pending: number; added: number; privacy: number; failed: number };
  recent_runs: RunLog[];
  warmup: WarmupState;
  warmup_schedule: Record<string, [number, number]>;
}

interface WarmupAccountResult {
  ok: boolean;
  account: string;
  account_id?: number;
  added?: number;
  privacy?: number;
  failed?: number;
  ban_triggered?: boolean;
  ban_note?: string;
  error?: string;
}

interface WarmupRunResult {
  ok: boolean;
  state?: WarmupState;
  message?: string;
  accounts_processed?: number;
  total_added?: number;
  results?: WarmupAccountResult[];
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

interface RunResult {
  ok: boolean;
  error?: string;
  account?: { id: number; label: string };
  attempted?: number;
  added?: number;
  privacy?: number;
  failed?: number;
  ban_triggered?: boolean;
  ban_note?: string;
  switched_to_account_id?: number | null;
  results?: { username: string; status: string; reason?: string }[];
  message?: string;
  switched?: boolean;
}

export function AdminInviteRunner({ token }: { token: string }) {
  const [status, setStatus] = useState<RunnerStatus | null>(null);
  const [batchSize, setBatchSize] = useState(3);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<RunResult | null>(null);

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

  async function runBatch() {
    if (!status?.active_account) {
      alert("Нет активного аккаунта в пуле. Подключи или активируй один.");
      return;
    }
    if (status.queue.pending === 0) {
      alert("В очереди нет кандидатов со статусом «Ожидает». Загрузи список.");
      return;
    }
    const size = Math.min(batchSize, status.active_account.daily_remaining, status.max_batch);
    const minutes = Math.ceil((size * status.pause_range_sec[1]) / 60);
    if (!confirm(
      `Запустить ПРЯМОЙ ИНВАЙТ ${size} человек в ${status.target_group}?\n\n` +
      `Аккаунт: ${status.active_account.label}\n` +
      `Остаток на сегодня: ${status.active_account.daily_remaining}/${status.daily_limit}\n` +
      `Пауза между инвайтами: ${status.pause_range_sec[0]}-${status.pause_range_sec[1]} сек\n` +
      `Максимальное время: ~${minutes} мин\n\n` +
      `При бане — автоматически переключимся на следующий аккаунт.`
    )) return;

    setBusy(true);
    setLastResult(null);
    try {
      const r = await fetch(`${INVITE_RUNNER_URL}?action=run_batch`, {
        method: "POST", headers,
        body: JSON.stringify({ size }),
      });
      const j: RunResult = await r.json();
      setLastResult(j);
      await load();
      if (j.ban_triggered) {
        alert(`⚠️ Аккаунт улетел в бан/флуд: ${j.ban_note}\nАвтоматически переключились на следующий аккаунт. Нажми «Запустить» снова.`);
      }
    } catch (e) {
      alert(`Ошибка: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function warmupAction(action: "warmup_start" | "warmup_stop" | "warmup_reset" | "warmup_run") {
    if (action === "warmup_run") {
      if (!confirm(`Запустить прогрев на сегодня?\n\nСистема возьмёт ${status?.warmup.accounts_today} аккаунт(ов) × ${status?.warmup.per_account_today} инвайт(ов).\nЗаймёт несколько минут.`)) return;
    }
    if (action === "warmup_reset") {
      if (!confirm("Сбросить прогрев и начать с дня 1 заново?")) return;
    }
    setBusy(true);
    try {
      const r = await fetch(`${INVITE_RUNNER_URL}?action=${action}`, {
        method: "POST", headers, body: "{}",
      });
      const j = await r.json();
      if (action === "warmup_run") {
        const res = j as WarmupRunResult;
        const summary = res.results?.map(x =>
          `${x.ok ? "✅" : "❌"} ${x.account}: +${x.added || 0} добавлено${x.ban_triggered ? " (БАН!)" : ""}${x.error ? " — " + x.error : ""}`
        ).join("\n") || res.message || "Готово";
        alert(`День ${res.state?.day_num}: всего добавлено ${res.total_added || 0}\n\n${summary}`);
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!status) {
    return (
      <div className="glass rounded-2xl p-5 border border-white/5">
        <div className="text-center text-xs text-muted-foreground py-6">Загрузка...</div>
      </div>
    );
  }

  const acc = status.active_account;
  const noAccount = !acc;
  const noQueue = status.queue.pending === 0;
  const exhausted = acc && acc.daily_remaining <= 0;

  return (
    <div className="glass rounded-2xl p-5 border border-white/5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <Icon name="Send" size={20} />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold">Запуск прямого инвайта</h3>
          <p className="text-xs text-muted-foreground">
            Цель: <span className="text-white font-mono">{status.target_group}</span> · лимит {status.daily_limit}/сутки на аккаунт · пауза {status.pause_range_sec[0]}–{status.pause_range_sec[1]} сек
          </p>
        </div>
        <button
          onClick={load}
          className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition"
          title="Обновить"
        >
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

      {noAccount ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-200 flex gap-2">
          <Icon name="TriangleAlert" size={14} className="shrink-0 mt-0.5" />
          <div>Нет активного аккаунта в пуле. Подключи аккаунт выше или активируй один из существующих.</div>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-xs font-bold">
            {acc!.label.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">Активный: {acc!.label}</div>
            <div className="text-xs text-muted-foreground">
              Использовано сегодня: <span className={acc!.daily_remaining < 5 ? "text-amber-300" : "text-white"}>{acc!.daily_invites_used}/{status.daily_limit}</span>
              {" · "}
              Остаток: <span className="font-mono">{acc!.daily_remaining}</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">
            Размер пачки (1–{status.max_batch})
          </label>
          <input
            type="number"
            min={1}
            max={status.max_batch}
            value={batchSize}
            onChange={(e) => setBatchSize(Math.max(1, Math.min(status.max_batch, parseInt(e.target.value) || 1)))}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
          />
        </div>
        <button
          onClick={runBatch}
          disabled={busy || noAccount || noQueue || exhausted}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? (
            <>
              <Icon name="Loader2" size={15} className="animate-spin" />
              Идёт инвайт...
            </>
          ) : (
            <>
              <Icon name="Send" size={15} />
              Запустить пачку
            </>
          )}
        </button>
      </div>

      {busy && (
        <div className="text-xs text-muted-foreground text-center">
          Подожди — между инвайтами пауза {status.pause_range_sec[0]}–{status.pause_range_sec[1]} сек, страница может «висеть» до {Math.ceil((batchSize * status.pause_range_sec[1]) / 60)} мин
        </div>
      )}

      {lastResult && (
        <div className={`rounded-xl p-3 border text-xs ${
          lastResult.ok && !lastResult.ban_triggered
            ? "bg-green-500/10 border-green-500/30 text-green-200"
            : lastResult.ban_triggered
            ? "bg-red-500/10 border-red-500/30 text-red-200"
            : "bg-amber-500/10 border-amber-500/30 text-amber-200"
        }`}>
          <div className="font-semibold mb-1">
            {lastResult.error ? "Ошибка" : "Результат запуска"}
          </div>
          {lastResult.error && <div>{lastResult.error}</div>}
          {lastResult.message && <div>{lastResult.message}</div>}
          {lastResult.attempted !== undefined && (
            <div>
              Попыток: {lastResult.attempted} · Добавлено: {lastResult.added} · Приватность: {lastResult.privacy} · Ошибок: {lastResult.failed}
            </div>
          )}
          {lastResult.ban_triggered && (
            <div className="mt-1">⚠️ {lastResult.ban_note}. Аккаунт помечен забаненным, активирован следующий.</div>
          )}
          {lastResult.results && lastResult.results.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer opacity-80">Детали по каждому ({lastResult.results.length})</summary>
              <div className="mt-1 space-y-0.5 font-mono text-[11px]">
                {lastResult.results.map((r, i) => (
                  <div key={i} className="flex justify-between gap-2">
                    <span className="truncate">@{r.username}</span>
                    <span className={
                      r.status === "added" || r.status === "already_in" ? "text-green-300" :
                      r.status === "privacy" ? "text-orange-300" :
                      "text-red-300"
                    }>{r.status}{r.reason ? `: ${r.reason}` : ""}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

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