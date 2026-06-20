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
  return (
    <div className="flex items-center justify-between rounded-lg bg-[#111]/70 border border-white/10 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Icon name="Car" size={15} className="text-amber-400" />
        <div>
          <div className="text-white text-xs font-medium">{title}</div>
          <div className="text-white/45 text-[10px]">
            {cars == null ? "нет данных" : free ? "очереди нет" : `в очереди ~${cars} авто`}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-amber-400 font-bold text-sm">{fmtDuration(wait)}</div>
        <div className="text-white/40 text-[10px]">досмотр</div>
      </div>
    </div>
  );
}

export default function BridgeNewsWidget() {
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
        <div className="space-y-2 mb-3">
          <SideRow title="Со стороны Крыма (Керчь)" cars={data?.crimea_cars ?? null} wait={data?.crimea_wait ?? null} />
          <SideRow title="Со стороны Тамани" cars={data?.taman_cars ?? null} wait={data?.taman_wait ?? null} />
        </div>
      )}

      <p className="text-white/40 text-[10px] leading-snug mb-2">
        Время рассчитано по длине очереди на досмотр и может меняться. Окончательный прогноз формируется при
        заказе — учитываем среднее время досмотра и пиковые часы.
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
