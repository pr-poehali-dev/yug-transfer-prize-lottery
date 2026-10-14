import { useState } from "react";
import Icon from "@/components/ui/icon";
import { TG_LOOKUP_API } from "./listTypes";

interface Try {
  ok: boolean;
  sec: number;
  error?: string;
}

interface Result {
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
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState("");

  const run = async () => {
    setBusy(true);
    setErr("");
    setRes(null);
    try {
      const r = await fetch(`${TG_LOOKUP_API}?action=proxy_check`, { headers: { "X-Admin-Token": token } });
      const d = await r.json();
      if (d.ok) setRes(d);
      else setErr(d.error || "Не удалось проверить прокси");
    } catch {
      setErr("Проверка не завершилась — прокси слишком долго не отвечает");
    }
    setBusy(false);
  };

  const st = res ? STATUS[res.status] : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Icon name="Shield" size={14} className="text-cyan-300" />
        <span className="text-xs text-white/70">Прокси для Telegram</span>
        <button onClick={run} disabled={busy}
          className="ml-auto rounded-lg px-3 py-1.5 text-xs border border-cyan-400/30 text-cyan-200 hover:bg-cyan-500/10 flex items-center gap-1.5 disabled:opacity-60">
          <Icon name={busy ? "Loader2" : "Activity"} size={13} className={busy ? "animate-spin" : ""} />
          {busy ? "Проверяю… до 30 сек" : "Проверить прокси"}
        </button>
      </div>

      {err && <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{err}</div>}

      {res && st && (
        <div className={`rounded-xl border px-3 py-2.5 space-y-2 ${st.cls}`}>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Icon name={st.icon} size={16} />
            {res.secret ? st.text : "Прокси не задан — подключение идёт напрямую"}
          </div>
          <div className="text-[11px] text-white/60">
            {res.secret && <>{res.type} · {res.host} · секрет {res.secret} · </>}
            успешно {res.success} из {res.tries.length}
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
          {res.status !== "good" && res.secret && (
            <div className="text-[11px] text-white/55">
              Для стабильной работы нужен индивидуальный IPv4-прокси SOCKS5 — обновите секрет TG_PROXY_NEW.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ProxyCheck;
