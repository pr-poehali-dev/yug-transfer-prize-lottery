import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { INVITE_RUNNER_URL } from "./adminTypes";

interface FullPowerAccount {
  id: number;
  label: string;
  remaining: number;
  used: number;
}

interface Status {
  full_power_accounts: FullPowerAccount[];
  full_power_total_remaining: number;
  daily_limit: number;
  queue: { pending: number };
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

export function AdminFullPower({ token }: { token: string }) {
  const [data, setData] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [batchSize, setBatchSize] = useState(5);

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

  async function runFullPower() {
    if (!data?.full_power_accounts?.length) {
      alert("Нет прогретых аккаунтов. Переведи нужные в режим «полной мощности»");
      return;
    }
    const total = data.full_power_accounts.length * batchSize;
    if (!confirm(
      `Запустить пачку инвайтов?\n\n` +
      `${data.full_power_accounts.length} аккаунт(ов) × ${batchSize} инвайт(ов) = ${total} человек\n\n` +
      `Между инвайтами 90-180 сек, между аккаунтами 30-60 сек.\n` +
      `Может занять до 10-15 минут — не закрывай вкладку.`
    )) return;

    setBusy(true);
    try {
      const r = await fetch(`${INVITE_RUNNER_URL}?action=run_full_power`, {
        method: "POST", headers,
        body: JSON.stringify({ batch_per_account: batchSize }),
      });
      const j = await r.json();
      if (j.results) {
        const summary = j.results.map((x: AccResult) =>
          `${x.ok ? "✅" : "❌"} ${x.account}: +${x.added || 0}${x.ban_triggered ? " БАН!" : ""}${x.error ? ` — ${x.error}` : ""}`
        ).join("\n");
        alert(`Готово!\nВсего добавлено: ${j.total_added || 0}\n\n${summary}`);
      } else if (j.error) {
        alert(`Ошибка: ${j.error}`);
      }
      await load();
    } catch (e) {
      alert(`Ошибка: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  if (!data) return null;
  const accs = data.full_power_accounts || [];
  const noQueue = data.queue.pending === 0;

  return (
    <div className="glass rounded-2xl p-5 border border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-pink-500/5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <Icon name="Zap" size={20} />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold">Полная мощность (прогретые)</h3>
          <p className="text-xs text-muted-foreground">Все прогретые аккаунты льют по {data.daily_limit}/сутки</p>
        </div>
      </div>

      {accs.length === 0 ? (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200">
          Нет прогретых аккаунтов. В блоке «Аккаунты для добавления» нажми бэйдж <b>🔥 прогрев</b> у нужных аккаунтов чтобы перевести в <b>⚡ полная мощность</b>.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            {accs.map(a => (
              <div key={a.id} className="bg-white/[0.03] rounded-lg p-2 border border-white/10">
                <div className="text-xs font-medium truncate">{a.label}</div>
                <div className="text-[11px] text-muted-foreground">
                  Сегодня: <b className="text-white">{a.used}</b>/{data.daily_limit}
                </div>
                <div className="text-[11px]">
                  Остаток: <b className="text-purple-300">{a.remaining}</b>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white/[0.03] rounded-xl p-3 mb-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Всего в пуле остаток на сегодня:</span>
              <span className="font-bold text-purple-300 text-base">{data.full_power_total_remaining} инвайтов</span>
            </div>
          </div>

          <div className="flex items-end gap-3 mb-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">
                Сколько инвайтов с каждого аккаунта за один запуск (1-10)
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={batchSize}
                onChange={(e) => setBatchSize(Math.max(1, Math.min(10, parseInt(e.target.value) || 5)))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
            <button
              onClick={runFullPower}
              disabled={busy || noQueue}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm hover:opacity-90 transition disabled:opacity-40"
            >
              {busy ? (
                <><Icon name="Loader2" size={15} className="animate-spin" />Идёт инвайт...</>
              ) : (
                <><Icon name="Zap" size={15} />Залить {accs.length * batchSize} человек</>
              )}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Чтобы выдать дневную норму ({accs.length * data.daily_limit} чел) — запусти {Math.ceil(data.daily_limit / batchSize)} раз с интервалами по 1-2 часа
          </p>

          {noQueue && (
            <div className="mt-3 text-xs text-amber-300 text-center">
              ⚠️ В очереди нет кандидатов — инвайтить некого
            </div>
          )}
        </>
      )}
    </div>
  );
}
