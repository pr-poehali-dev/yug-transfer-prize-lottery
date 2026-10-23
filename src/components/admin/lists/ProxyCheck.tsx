import { useState } from "react";
import Icon from "@/components/ui/icon";
import { TG_LOOKUP_API } from "./listTypes";

interface Try {
  ok: boolean;
  sec: number;
  error?: string;
}

interface Result {
  empty?: boolean;
  secret: string;
  type: string;
  host: string;
  tries: Try[];
  success: number;
  avg: number | null;
  status: "good" | "slow" | "down";
}

const STATUS = {
  good: { text: "Прокси работает хорошо", cls: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200", icon: "CircleCheck" },
  slow: { text: "Прокси работает, но медленно или с обрывами", cls: "border-amber-400/30 bg-amber-500/10 text-amber-200", icon: "TriangleAlert" },
  down: { text: "Прокси не подключается к Telegram", cls: "border-red-400/30 bg-red-500/10 text-red-200", icon: "CircleX" },
} as const;

export function ProxyCheck({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState<Result[]>([]);
  const [err, setErr] = useState("");

  const run = async () => {
    setBusy(true);
    setErr("");
    setList([]);
    try {
      const r = await fetch(`${TG_LOOKUP_API}?action=proxy_check_all`, { headers: { "X-Admin-Token": token } });
      const d = await r.json();
      if (d.ok) setList(d.items || []);
      else setErr(d.error || "Не удалось проверить прокси");
    } catch {
      setErr("Проверка не завершилась — прокси слишком долго не отвечает");
    }
    setBusy(false);
  };


  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 shrink-0 rounded-xl bg-cyan-500/10 flex items-center justify-center">
          <Icon name="Shield" size={16} className="text-cyan-300" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-white">Прокси для Telegram</div>
          <div className="text-[11px] text-white/50">{busy ? "Проверяю… до 1 минуты" : "Связь сканера с Telegram"}</div>
        </div>
        <button onClick={run} disabled={busy}
          className="shrink-0 rounded-xl px-3 py-2 text-xs font-medium border border-cyan-400/30 text-cyan-200 bg-cyan-500/10 hover:bg-cyan-500/20 flex items-center gap-1.5 whitespace-nowrap disabled:opacity-60">
          <Icon name={busy ? "Loader2" : "Activity"} size={14} className={busy ? "animate-spin" : ""} />
          {busy ? "Проверка" : "Проверить"}
        </button>
      </div>

      {err && <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{err}</div>}

      {list.map((res) => {
        if (res.empty) return (
          <div key={res.secret} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/50">
            <b className="text-white/80">{res.secret}</b> — не заполнен
          </div>
        );
        const st = STATUS[res.status];
        return (
          <div key={res.secret} className={`rounded-xl border px-3 py-2.5 space-y-2 ${st.cls}`}>
            <div className="flex items-center gap-2 text-sm font-medium flex-wrap">
              <Icon name={st.icon} size={16} />
              <span className="font-mono">{res.secret}</span>
              <span>— {res.status === "down" ? "не работает, можно удалить" : res.status === "slow" ? "работает плохо" : "работает"}</span>
            </div>
            <div className="text-[11px] text-white/60">
              {res.type} · {res.host} · успешно {res.success} из {res.tries.length}
              {res.avg !== null && <> · в среднем {res.avg} сек</>}
            </div>
            <div className="grid sm:grid-cols-3 gap-1.5">
              {res.tries.map((t, i) => (
                <div key={i} className="rounded-lg bg-black/25 px-2.5 py-1.5 text-[11px] flex items-center gap-1.5 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${t.ok ? (t.sec <= 4 ? "bg-emerald-400" : "bg-amber-400") : "bg-red-400"}`} />
                  <span className="text-white/80 shrink-0">#{i + 1}</span>
                  <span className="text-white/60 truncate">{t.ok ? `${t.sec} сек` : `${t.error} · ${t.sec} сек`}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {list.length > 0 && (
        <div className="text-[11px] text-white/50">
          Сейчас в работе первый заполненный по порядку: TG_PROXY_3 → TG_PROXY_NEW → TG_PROXY.
        </div>
      )}
    </div>
  );
}

export default ProxyCheck;
