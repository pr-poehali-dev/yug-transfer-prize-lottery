import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "@/components/ui/icon";

const BRIDGE_NEWS_URL = "https://functions.poehali.dev/3af26657-db34-4fcf-9d05-41d0122fbe3b";

type BridgeStatus = "open" | "limited" | "closed";

interface BridgeData {
  status: BridgeStatus;
  wait: number | null;
  status_updated: string | null;
}

const STATUS_META: Record<BridgeStatus, { label: string; dot: string; text: string }> = {
  open: { label: "Проезд открыт", dot: "bg-green-500", text: "text-green-400" },
  limited: { label: "Движение ограничено", dot: "bg-amber-500", text: "text-amber-400" },
  closed: { label: "Проезд перекрыт", dot: "bg-red-500", text: "text-red-400" },
};

const ROUTES = [
  { id: "anapa", label: "Анапа — Керчь", base: 90 },
  { id: "krasnodar", label: "Краснодар — Симферополь", base: 270 },
  { id: "rostov", label: "Ростов — Симферополь", base: 420 },
];

function fmtDuration(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h <= 0) return `${m} мин`;
  if (m === 0) return `${h} ч`;
  return `${h} ч ${m} мин`;
}

function timeOnly(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function BridgeNewsWidget() {
  const [data, setData] = useState<BridgeData | null>(null);
  const [routeId, setRouteId] = useState(ROUTES[0].id);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetch(`${BRIDGE_NEWS_URL}?t=${Date.now()}`)
        .then((r) => r.json())
        .then((d) => {
          if (!active) return;
          setData({
            status: (d.status as BridgeStatus) || "open",
            wait: typeof d.wait === "number" ? d.wait : null,
            status_updated: d.status_updated || null,
          });
        })
        .catch(() => {});
    load();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 60000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const route = useMemo(() => ROUTES.find((r) => r.id === routeId) || ROUTES[0], [routeId]);
  const status: BridgeStatus = data?.status || "open";
  const wait = data?.wait ?? (status === "open" ? 20 : 40);
  const meta = STATUS_META[status];
  const total = route.base + wait;

  return (
    <div className="bg-[#1a1a1a]/95 backdrop-blur rounded-xl border border-white/10 shadow-2xl p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <Icon name="Construction" size={15} className="text-amber-400" />
        <span className="font-bold text-white text-sm">Проезд через Крымский мост</span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className="relative flex h-2 w-2">
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${meta.dot}`} />
          <span className={`relative inline-flex h-2 w-2 rounded-full ${meta.dot}`} />
        </span>
        <span className={`font-semibold text-sm ${meta.text}`}>{meta.label}</span>
        {status !== "closed" && (
          <span className="ml-auto text-white/80 text-xs flex items-center gap-1">
            <Icon name="Clock" size={13} className="text-amber-400" />
            досмотр ~{wait} мин
          </span>
        )}
      </div>

      {status === "closed" ? (
        <div className="rounded-lg bg-red-500/10 border border-red-500/25 p-3 mb-3">
          <p className="text-white/85 text-xs leading-snug mb-2">
            Сейчас проезд по мосту закрыт. Оставьте заявку — подберём альтернативный маршрут и рассчитаем
            точное время в пути.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-amber-400 text-xs font-semibold hover:underline"
          >
            <Icon name="Plus" size={13} /> Оставить заявку
          </Link>
        </div>
      ) : (
        <div className="mb-3">
          <label className="block text-white/50 text-[11px] mb-1.5">Откуда едете</label>
          <select
            value={routeId}
            onChange={(e) => setRouteId(e.target.value)}
            className="w-full bg-[#111]/80 border border-white/15 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
          >
            {ROUTES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>

          <div className="mt-3 flex items-center justify-between rounded-lg bg-amber-500/10 border border-amber-500/25 px-3 py-2.5">
            <span className="text-white/70 text-xs">Время в пути с учётом досмотра</span>
            <span className="text-amber-400 font-bold text-base">{fmtDuration(total)}</span>
          </div>
        </div>
      )}

      <p className="text-white/40 text-[10px] leading-snug mb-2">
        Время ожидания может меняться. Окончательный прогноз формируется при заказе — учитываем среднее время
        досмотра и пиковые часы.
      </p>

      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        {data?.status_updated ? (
          <span className="text-white/35 text-[10px]">Обновлено: {timeOnly(data.status_updated)}</span>
        ) : (
          <span className="text-white/35 text-[10px]">Отслеживаем обстановку</span>
        )}
        <Link to="/bridge" className="text-amber-400 text-[11px] flex items-center gap-0.5 hover:underline">
          Подробнее <Icon name="ChevronRight" size={12} />
        </Link>
      </div>
    </div>
  );
}
