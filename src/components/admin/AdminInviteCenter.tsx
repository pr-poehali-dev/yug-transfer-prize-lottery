import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { INVITE_RUNNER_URL } from "./adminTypes";
import { useInviteProgress } from "./InviteProgressContext";

type Mode = "full_power" | "warmup" | "manual";

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
  const [mode, setMode] = useState<Mode>("full_power");
  const [status, setStatus] = useState<CenterStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [batchSize, setBatchSize] = useState(5);
  const [warmupDay, setWarmupDay] = useState(1);
  const [manualSize, setManualSize] = useState(3);
  const { start: startProgress, stop: stopProgress } = useInviteProgress();

  const headers = { "Content-Type": "application/json", "X-Admin-Token": token };

  async function load() {
    try {
      const r = await fetch(INVITE_RUNNER_URL, { headers });
      const j = await r.json();
      setStatus(j);
      if (j.warmup?.day_num) setWarmupDay(j.warmup.day_num);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => { load(); }, []);

  async function runFullPower() {
    if (!status?.full_power_accounts?.length) {
      alert("Нет прогретых аккаунтов. Переведи нужные в режим «полной мощности»");
      return;
    }
    const total = status.full_power_accounts.length * batchSize;
    if (!confirm(
      `Запустить пачку?\n\n${status.full_power_accounts.length} × ${batchSize} = ${total} человек\n\n` +
      `Между инвайтами 90-180 сек, между аккаунтами 30-60 сек. Может занять до 15 минут.`
    )) return;

    setBusy(true);
    const accCount = status.full_power_accounts.length;
    const estimated = total * 135 + Math.max(0, accCount - 1) * 45;
    startProgress({
      mode: "full_power",
      title: `Полная мощность: ${accCount} × ${batchSize} = ${total} человек`,
      subtitle: `Прогретые аккаунты, паузы 90-180 сек`,
      estimatedSec: estimated,
    });
    try {
      const r = await fetch(`${INVITE_RUNNER_URL}?action=run_full_power`, {
        method: "POST", headers, body: JSON.stringify({ batch_per_account: batchSize }),
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

  async function changeWarmupDay(day: number) {
    if (!confirm(`Установить день прогрева = ${day}?\n\nСистема будет считать что сегодня уже ${day}-й день прогрева. ${getDayInfo(day)}`)) return;
    setBusy(true);
    try {
      await fetch(`${INVITE_RUNNER_URL}?action=warmup_set_day`, {
        method: "POST", headers, body: JSON.stringify({ day }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  function getDayInfo(day: number): string {
    if (!status?.warmup_schedule) return "";
    const sch = status.warmup_schedule[String(day)];
    if (sch) return `${sch[0]} аккаунт(ов) × ${sch[1]} = ${sch[0] * sch[1]} человек`;
    return `4 × ${Math.min(4 + (day - 4), 30)} = ${4 * Math.min(4 + (day - 4), 30)} человек`;
  }

  async function runWarmup() {
    const accs = status?.warmup.accounts_today || 0;
    const per = status?.warmup.per_account_today || 0;
    const total = accs * per;
    if (!confirm(`Прогрев день ${status?.warmup.day_num}: ${accs} × ${per} = ${total} человек?\n\nПауза 90-180 сек между инвайтами.`)) return;

    setBusy(true);
    const estimated = total * 135 + Math.max(0, accs - 1) * 60;
    startProgress({
      mode: "warmup",
      title: `Прогрев день ${status?.warmup.day_num}: ${accs} × ${per} = ${total} человек`,
      estimatedSec: estimated,
    });
    try {
      const r = await fetch(`${INVITE_RUNNER_URL}?action=warmup_run`, {
        method: "POST", headers, body: "{}",
      });
      const j = await r.json();
      const summary = j.results?.map((x: AccResult) =>
        `${x.ok ? "✅" : "❌"} ${x.account}: +${x.added || 0}${x.ban_triggered ? " БАН!" : ""}${x.error ? ` (${x.error})` : ""}`
      ).join("\n") || j.message || "Готово";
      alert(`День ${j.state?.day_num}: добавлено ${j.total_added || 0}\n\n${summary}`);
      await load();
    } finally {
      setBusy(false);
      stopProgress();
    }
  }

  async function toggleWarmupEnabled() {
    const act = status?.warmup.enabled ? "warmup_stop" : "warmup_start";
    setBusy(true);
    try {
      await fetch(`${INVITE_RUNNER_URL}?action=${act}`, { method: "POST", headers, body: "{}" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function runManualBatch() {
    if (!status?.active_account) { alert("Нет активного аккаунта"); return; }
    if (status.queue.pending === 0) { alert("В очереди нет кандидатов"); return; }
    const size = Math.min(manualSize, status.active_account.daily_remaining, status.max_batch);
    if (!confirm(`Запустить ${size} инвайтов с «${status.active_account.label}»?\n\nОстаток: ${status.active_account.daily_remaining}/${status.daily_limit}\nПауза 90-180 сек.`)) return;

    setBusy(true);
    startProgress({
      mode: "batch",
      title: `Инвайт пачки: ${size} человек с «${status.active_account.label}»`,
      estimatedSec: size * 135,
    });
    try {
      const r = await fetch(`${INVITE_RUNNER_URL}?action=run_batch`, {
        method: "POST", headers, body: JSON.stringify({ size }),
      });
      const j = await r.json();
      if (j.ban_triggered) alert(`⚠️ Бан: ${j.ban_note}\nПереключились на следующий аккаунт.`);
      else alert(`Результат: +${j.added || 0} добавлено, ${j.privacy || 0} приватность, ${j.failed || 0} ошибок`);
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

  const TABS: { id: Mode; label: string; icon: string; gradient: string; iconBg: string }[] = [
    { id: "full_power", label: "Полная мощность", icon: "Zap",  gradient: "from-purple-500 to-pink-500",   iconBg: "from-purple-500 to-pink-500" },
    { id: "warmup",     label: "Прогрев",         icon: "Flame", gradient: "from-orange-500 to-amber-500", iconBg: "from-orange-500 to-amber-500" },
    { id: "manual",     label: "Ручной запуск",   icon: "Send",  gradient: "from-blue-500 to-cyan-500",    iconBg: "from-blue-500 to-cyan-500" },
  ];
  const activeTab = TABS.find(t => t.id === mode)!;

  return (
    <div className="glass rounded-2xl p-5 border border-white/5 space-y-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${activeTab.iconBg} flex items-center justify-center`}>
          <Icon name={activeTab.icon} size={20} />
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

      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/10">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition ${
              mode === t.id
                ? `bg-gradient-to-r ${t.gradient} text-white shadow-lg`
                : "text-muted-foreground hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon name={t.icon} size={14} />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {mode === "full_power" && (
        <div className="space-y-3 animate-in fade-in duration-200">
          {fpAccs.length === 0 ? (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200">
              Нет прогретых аккаунтов. В блоке «Аккаунты» нажми бэйдж <b>🔥 прогрев</b> → переведи в <b>⚡ полная мощность</b>.
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

              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Инвайтов с каждого за раз (1-10)</label>
                  <input
                    type="number" min={1} max={10} value={batchSize}
                    onChange={(e) => setBatchSize(Math.max(1, Math.min(10, parseInt(e.target.value) || 5)))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
                <button
                  onClick={runFullPower}
                  disabled={busy || noQueue}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm hover:opacity-90 transition disabled:opacity-40"
                >
                  {busy ? <><Icon name="Loader2" size={15} className="animate-spin" />Идёт инвайт...</>
                        : <><Icon name="Zap" size={15} />Залить {fpAccs.length * batchSize}</>}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Чтобы выдать дневную норму ({fpAccs.length * status.daily_limit} чел) — запусти {Math.ceil(status.daily_limit / batchSize)} раз с интервалами 1-2 часа
              </p>
            </>
          )}
        </div>
      )}

      {mode === "warmup" && (
        <div className="space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between bg-white/[0.03] rounded-xl p-3">
            <div className="text-xs">
              <div className="font-semibold">Режим прогрева</div>
              <div className="text-muted-foreground">{status.warmup.enabled ? "Включён" : "Выключен"} · только для аккаунтов с флагом 🔥</div>
            </div>
            <button
              onClick={toggleWarmupEnabled}
              disabled={busy}
              className={`text-[10px] uppercase font-bold px-3 py-1.5 rounded-lg transition ${
                status.warmup.enabled
                  ? "bg-green-500/20 text-green-300 hover:bg-green-500/30"
                  : "bg-white/10 text-muted-foreground hover:bg-white/20"
              }`}
            >
              {status.warmup.enabled ? "включён" : "выключен"}
            </button>
          </div>

          <div>
            <div className="text-xs font-semibold mb-2 text-amber-300">Выбери день прогрева:</div>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {[1, 2, 3, 4].map(d => {
                const sch = status.warmup_schedule[String(d)];
                const isCurrent = status.warmup.day_num === d;
                return (
                  <button
                    key={d}
                    onClick={() => changeWarmupDay(d)}
                    disabled={busy || isCurrent}
                    className={`rounded-lg p-2 text-center border transition ${
                      isCurrent
                        ? "border-orange-500 bg-orange-500/15 ring-2 ring-orange-500/50"
                        : "border-white/10 bg-white/[0.02] hover:bg-white/5 hover:border-white/20"
                    }`}
                  >
                    <div className="text-[10px] uppercase text-muted-foreground">День {d}</div>
                    <div className="text-sm font-bold mt-0.5">
                      {sch ? `${sch[0]} × ${sch[1]}` : "—"}
                    </div>
                    <div className="text-[10px] text-muted-foreground">= {sch ? sch[0] * sch[1] : 0} чел</div>
                    {isCurrent && (
                      <div className="text-[9px] uppercase font-bold text-orange-300 mt-0.5">сейчас</div>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Кликни на день чтобы перевести систему в этот этап. Дни 5+ — каждый день +1 инвайт до лимита 30.
            </p>
          </div>

          {status.warmup.start_date && (
            <div className="bg-white/[0.03] rounded-xl p-3 text-xs flex items-center gap-3">
              <Icon name="Calendar" size={14} className="text-amber-300 shrink-0" />
              <div className="flex-1">
                <div>Старт: <span className="font-mono">{status.warmup.start_date}</span> · сейчас день <b className="text-orange-300">{status.warmup.day_num}</b></div>
                <div className="text-muted-foreground mt-0.5">
                  Сегодня: <b className="text-white">{status.warmup.accounts_today}</b> × <b className="text-white">{status.warmup.per_account_today}</b> = <b className="text-orange-300">{status.warmup.accounts_today * status.warmup.per_account_today} человек</b>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={runWarmup}
            disabled={busy || noQueue}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 text-white text-sm hover:opacity-90 transition disabled:opacity-40"
          >
            {busy ? <><Icon name="Loader2" size={15} className="animate-spin" />Идёт прогрев...</>
                  : <><Icon name="Flame" size={15} />Прогреть на сегодня ({status.warmup.accounts_today * status.warmup.per_account_today})</>}
          </button>
        </div>
      )}

      {mode === "manual" && (
        <div className="space-y-3 animate-in fade-in duration-200">
          {status.active_account ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-xs font-bold">
                {status.active_account.label.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">Активный: {status.active_account.label}</div>
                <div className="text-xs text-muted-foreground">
                  Использовано: <span className={status.active_account.daily_remaining < 5 ? "text-amber-300" : "text-white"}>{status.active_account.daily_invites_used}/{status.daily_limit}</span>
                  {" · "}Остаток: <span className="font-mono">{status.active_account.daily_remaining}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-200">
              Нет активного аккаунта в пуле.
            </div>
          )}

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Размер пачки (1-{status.max_batch})</label>
              <input
                type="number" min={1} max={status.max_batch} value={manualSize}
                onChange={(e) => setManualSize(Math.max(1, Math.min(status.max_batch, parseInt(e.target.value) || 1)))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={runManualBatch}
              disabled={busy || noQueue || !status.active_account}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-sm hover:opacity-90 transition disabled:opacity-40"
            >
              {busy ? <><Icon name="Loader2" size={15} className="animate-spin" />Идёт...</>
                    : <><Icon name="Send" size={15} />Запустить пачку</>}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Запускает пачку с активного аккаунта. При бане — авто-переключение на следующий.
          </p>
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
