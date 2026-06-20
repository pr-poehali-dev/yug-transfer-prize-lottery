import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "@/components/ui/icon";

const BRIDGE_NEWS_URL = "https://functions.poehali.dev/3af26657-db34-4fcf-9d05-41d0122fbe3b";

type BridgeStatus = "open" | "limited" | "closed";

interface BridgeData {
  status: BridgeStatus;
  crimea_cars: number | null;
  taman_cars: number | null;
  crimea_wait: number | null;
  taman_wait: number | null;
  status_updated: string | null;
}

const STATUS_META: Record<BridgeStatus, { label: string; dot: string; text: string }> = {
  open: { label: "Проезд открыт", dot: "bg-green-500", text: "text-green-400" },
  limited: { label: "Движение ограничено", dot: "bg-amber-500", text: "text-amber-400" },
  closed: { label: "Проезд перекрыт", dot: "bg-red-500", text: "text-red-400" },
};

const BRIDGE_LENGTH_KM = 19;
const BRIDGE_DRIVE_MIN = 17;

type Side = "crimea" | "kuban";

const CITY_INFO: Record<string, { min: number; side: Side }> = {
  керчь: { min: 30, side: "crimea" },
  феодосия: { min: 110, side: "crimea" },
  судак: { min: 150, side: "crimea" },
  алушта: { min: 195, side: "crimea" },
  ялта: { min: 220, side: "crimea" },
  симферополь: { min: 130, side: "crimea" },
  севастополь: { min: 200, side: "crimea" },
  евпатория: { min: 175, side: "crimea" },
  саки: { min: 160, side: "crimea" },
  джанкой: { min: 130, side: "crimea" },
  краснодар: { min: 270, side: "kuban" },
  анапа: { min: 90, side: "kuban" },
  новороссийск: { min: 110, side: "kuban" },
  геленджик: { min: 160, side: "kuban" },
  тамань: { min: 25, side: "kuban" },
  темрюк: { min: 60, side: "kuban" },
  сочи: { min: 400, side: "kuban" },
  ростов: { min: 480, side: "kuban" },
};

function lookupCity(q: string): { min: number; side: Side } | null {
  const k = q.trim().toLowerCase();
  if (!k) return null;
  if (CITY_INFO[k]) return CITY_INFO[k];
  const hit = Object.keys(CITY_INFO).find((c) => c.startsWith(k) || k.startsWith(c));
  return hit ? CITY_INFO[hit] : null;
}

function fmtDuration(total: number | null): string {
  if (total == null) return "—";
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

function SideRow({
  title,
  cars,
  wait,
}: {
  title: string;
  cars: number | null;
  wait: number | null;
}) {
  const free = cars != null && cars <= 0;
  const total = wait != null ? wait + BRIDGE_DRIVE_MIN : null;
  return (
    <div className="flex items-center justify-between rounded-lg bg-[#111]/70 border border-white/10 px-2.5 py-1.5">
      <div className="flex items-center gap-1.5 min-w-0">
        <Icon name="Car" size={13} className="text-amber-400 shrink-0" />
        <div className="min-w-0">
          <div className="text-white text-[11px] font-medium truncate">{title}</div>
          <div className="text-white/45 text-[9px]">
            {cars == null ? "нет данных" : free ? "очереди нет" : `~${cars} авто в очереди`}
          </div>
        </div>
      </div>
      <div className="text-right shrink-0 pl-2">
        <div className="text-amber-400 font-bold text-[13px] leading-none">{fmtDuration(total)}</div>
        <div className="text-white/40 text-[9px] mt-0.5">досмотр + мост</div>
      </div>
    </div>
  );
}

export default function BridgeNewsWidget({ calc = false }: { calc?: boolean }) {
  const [data, setData] = useState<BridgeData | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetch(`${BRIDGE_NEWS_URL}?t=${Date.now()}`)
        .then((r) => r.json())
        .then((d) => {
          if (!active) return;
          setData({
            status: (d.status as BridgeStatus) || "open",
            crimea_cars: typeof d.crimea_cars === "number" ? d.crimea_cars : null,
            taman_cars: typeof d.taman_cars === "number" ? d.taman_cars : null,
            crimea_wait: typeof d.crimea_wait === "number" ? d.crimea_wait : null,
            taman_wait: typeof d.taman_wait === "number" ? d.taman_wait : null,
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

  const status: BridgeStatus = data?.status || "open";
  const meta = STATUS_META[status];

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const fromCity = lookupCity(from);
  const toCity = lookupCity(to);
  const crossesBridge = !!fromCity && !!toCity && fromCity.side !== toCity.side;
  const bridgeWait = crossesBridge
    ? toCity!.side === "crimea"
      ? data?.taman_wait ?? 0
      : data?.crimea_wait ?? 0
    : 0;
  const roadMin =
    fromCity && toCity
      ? crossesBridge
        ? fromCity.min + toCity.min + BRIDGE_DRIVE_MIN + bridgeWait
        : Math.abs(toCity.min - fromCity.min)
      : null;
  const totalMin = roadMin != null && !(crossesBridge && status === "closed") ? roadMin : null;
  const showCalc = calc;
  const calcError = (from.trim() || to.trim()) && (fromCity == null || toCity == null);

  return (
    <div className="bg-[#1a1a1a]/95 backdrop-blur rounded-xl border border-white/10 shadow-2xl p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon name="Construction" size={14} className="text-amber-400 shrink-0" />
          <span className="font-bold text-white text-[13px] truncate">Крымский мост</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="relative flex h-2 w-2">
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${meta.dot}`} />
            <span className={`relative inline-flex h-2 w-2 rounded-full ${meta.dot}`} />
          </span>
          <span className={`font-semibold text-[12px] ${meta.text}`}>{meta.label}</span>
        </div>
      </div>

      {status === "closed" ? (
        <div className="rounded-lg bg-red-500/10 border border-red-500/25 p-2.5 mb-2">
          <p className="text-white/85 text-[11px] leading-snug mb-1.5">
            Сейчас проезд по мосту закрыт. Оставьте заявку — подберём альтернативный маршрут.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-amber-400 text-[11px] font-semibold hover:underline"
          >
            <Icon name="Plus" size={12} /> Оставить заявку
          </Link>
        </div>
      ) : (
        <div className="space-y-1.5 mb-2">
          <SideRow title="Со стороны Крыма (Керчь)" cars={data?.crimea_cars ?? null} wait={data?.crimea_wait ?? null} />
          <SideRow title="Со стороны Тамани" cars={data?.taman_cars ?? null} wait={data?.taman_wait ?? null} />
        </div>
      )}

      <p className="text-white/40 text-[9px] leading-snug mb-1.5">
        Время = очередь на досмотр + проезд моста ({BRIDGE_LENGTH_KM} км, ≈{BRIDGE_DRIVE_MIN} мин). Может меняться в пиковые часы.
      </p>

      {showCalc && (
        <div className="rounded-lg bg-[#111]/70 border border-white/10 p-2.5 mb-2">
          <div className="flex items-center gap-1.5 mb-2">
            <Icon name="Calculator" size={13} className="text-amber-400" />
            <span className="text-white text-[11px] font-semibold">Расчёт времени в пути</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 mb-1.5">
            <input
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="Откуда"
              className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-white placeholder-white/35 text-[11px] outline-none focus:border-amber-500/60"
            />
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="Куда"
              className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-white placeholder-white/35 text-[11px] outline-none focus:border-amber-500/60"
            />
          </div>
          {totalMin != null ? (
            <div className="flex items-center justify-between gap-2 rounded-md bg-amber-500/10 border border-amber-500/25 px-2.5 py-1.5">
              <span className="text-white/70 text-[10px] leading-tight">
                Ориентир. время в пути
                {crossesBridge ? " (через мост)" : " (мост не нужен)"}
              </span>
              <span className="text-amber-400 font-bold text-[13px] shrink-0">≈ {fmtDuration(totalMin)}</span>
            </div>
          ) : crossesBridge && status === "closed" ? (
            <p className="text-red-400/80 text-[10px]">Мост перекрыт — расчёт через мост недоступен.</p>
          ) : calcError ? (
            <p className="text-white/40 text-[10px]">Укажите города рядом с мостом (Керчь, Краснодар, Ялта, Анапа…).</p>
          ) : (
            <p className="text-white/40 text-[10px]">Впишите города — покажем время с учётом проезда моста.</p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-1.5 border-t border-white/5">
        {data?.status_updated ? (
          <span className="text-white/35 text-[9px]">Обновлено: {timeOnly(data.status_updated)}</span>
        ) : (
          <span className="text-white/35 text-[9px]">Отслеживаем обстановку</span>
        )}
        <Link to="/bridge" className="text-amber-400 text-[10px] flex items-center gap-0.5 hover:underline">
          Подробнее <Icon name="ChevronRight" size={11} />
        </Link>
      </div>
    </div>
  );
}