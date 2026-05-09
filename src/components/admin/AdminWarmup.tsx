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
  warmup: WarmupState;
  warmup_schedule: Record<string, [number, number]>;
  queue: { pending: number };
}

interface WarmupAccountResult {
  ok: boolean;
  account: string;
  added?: number;
  ban_triggered?: boolean;
  error?: string;
}

export function AdminWarmup({ token }: { token: string }) {
  const [data, setData] = useState<RunnerStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const headers = { "Content-Type": "application/json", "X-Admin-Token": token };

  async function load() {
    try {
      const r = await fetch(INVITE_RUNNER_URL, { headers });
      const j = await r.json();
      setData(j);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => { load(); }, []);

  async function action(act: "warmup_start" | "warmup_stop" | "warmup_reset" | "warmup_run") {
    if (act === "warmup_run") {
      if (!confirm(
        `Запустить прогрев на сегодня?\n\n` +
        `День ${data?.warmup.day_num}: ${data?.warmup.accounts_today} аккаунт(ов) × ${data?.warmup.per_account_today} инвайт(ов) = ${(data?.warmup.accounts_today || 0) * (data?.warmup.per_account_today || 0)} человек\n\n` +
        `Между инвайтами пауза 90-180 сек, между аккаунтами 60 сек. Может занять до 10 минут — не закрывай вкладку.`
      )) return;
    }
    if (act === "warmup_reset") {
      if (!confirm("Сбросить прогрев — начать с дня 1 заново?")) return;
    }
    setBusy(true);
    try {
      const r = await fetch(`${INVITE_RUNNER_URL}?action=${act}`, {
        method: "POST", headers, body: "{}",
      });
      const j = await r.json();
      if (act === "warmup_run") {
        const summary = j.results?.map((x: WarmupAccountResult) =>
          `${x.ok ? "✅" : "❌"} ${x.account}: +${x.added || 0}${x.ban_triggered ? " БАН!" : ""}${x.error ? ` (${x.error})` : ""}`
        ).join("\n") || j.message || "Готово";
        alert(`Результат прогрева (день ${j.state?.day_num}):\nДобавлено всего: ${j.total_added || 0}\n\n${summary}`);
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!data) return null;

  const w = data.warmup;
  const schedule = data.warmup_schedule;
  const noQueue = data.queue.pending === 0;

  return (
    <div className="glass rounded-2xl p-5 border border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-amber-500/5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
          <Icon name="Flame" size={20} />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold">Прогрев аккаунтов</h3>
          <p className="text-xs text-muted-foreground">Постепенное увеличение нагрузки чтобы не словить бан</p>
        </div>
        {w.enabled ? (
          <span className="text-[10px] uppercase font-bold px-2 py-1 rounded bg-green-500/20 text-green-300">включён</span>
        ) : (
          <span className="text-[10px] uppercase font-bold px-2 py-1 rounded bg-white/10 text-muted-foreground">выключен</span>
        )}
      </div>

      <div className="bg-white/[0.03] rounded-xl p-3 mb-3">
        <div className="text-xs font-semibold mb-2 text-amber-300">Расписание прогрева:</div>
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(schedule).map(([day, [accs, per]]) => {
            const isToday = w.day_num === parseInt(day);
            return (
              <div
                key={day}
                className={`rounded-lg p-2 text-center border ${
                  isToday ? "border-orange-500 bg-orange-500/10" : "border-white/10 bg-white/[0.02]"
                }`}
              >
                <div className="text-[10px] uppercase text-muted-foreground">День {day}</div>
                <div className="text-sm font-bold mt-0.5">
                  {accs}<span className="text-muted-foreground"> × </span>{per}
                </div>
                <div className="text-[10px] text-muted-foreground">= {accs * per} чел</div>
              </div>
            );
          })}
        </div>
      </div>

      {w.start_date ? (
        <div className="bg-white/[0.03] rounded-xl p-3 mb-3 flex items-center gap-3">
          <Icon name="Calendar" size={14} className="text-amber-300 shrink-0" />
          <div className="flex-1 text-xs">
            <div>Старт: <span className="font-mono">{w.start_date}</span> · сегодня день <span className="font-bold text-orange-300">{w.day_num}</span></div>
            <div className="text-muted-foreground mt-0.5">
              Сегодня по плану: <b className="text-white">{w.accounts_today}</b> аккаунт(ов) × <b className="text-white">{w.per_account_today}</b> инвайт(ов) = <b className="text-orange-300">{w.accounts_today * w.per_account_today} человек</b>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-3 text-xs text-amber-200">
          Прогрев ещё не запущен. Нажми «Запустить прогрев» — система зафиксирует сегодняшнюю дату как день 1.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => action("warmup_run")}
          disabled={busy || noQueue}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 text-white text-sm hover:opacity-90 transition disabled:opacity-40"
        >
          {busy ? (
            <><Icon name="Loader2" size={15} className="animate-spin" />Идёт прогрев...</>
          ) : (
            <><Icon name="Flame" size={15} />Прогреть на сегодня ({w.accounts_today * w.per_account_today})</>
          )}
        </button>

        {!w.enabled ? (
          <button
            onClick={() => action("warmup_start")}
            disabled={busy}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition disabled:opacity-40"
          >
            <Icon name="Play" size={14} />Включить режим
          </button>
        ) : (
          <button
            onClick={() => action("warmup_stop")}
            disabled={busy}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition disabled:opacity-40"
          >
            <Icon name="Pause" size={14} />Выключить режим
          </button>
        )}
      </div>

      {w.start_date && (
        <button
          onClick={() => action("warmup_reset")}
          disabled={busy}
          className="mt-2 w-full text-[11px] text-muted-foreground hover:text-white transition py-1"
        >
          Сбросить и начать с дня 1
        </button>
      )}

      {noQueue && (
        <div className="mt-3 text-xs text-amber-300 text-center">
          ⚠️ В очереди нет кандидатов — прогревать некого. Загрузи список.
        </div>
      )}
    </div>
  );
}
