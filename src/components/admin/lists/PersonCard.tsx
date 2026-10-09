import Icon from "@/components/ui/icon";
import { ListItem, FIELD_LABELS, fmtDate } from "./listTypes";

interface Props {
  item: ListItem;
  scanning: boolean;
  onEdit: () => void;
  onScan: () => void;
  onLayers: () => void;
}

export function PersonCard({ item, scanning, onEdit, onScan, onLayers }: Props) {
  const black = item.list_type === "black";
  const initials = (item.name || item.username || "?").replace("@", "").slice(0, 2).toUpperCase();
  const layers = Math.max(1, item.layers || 1);
  const behind = Math.min(layers - 1, 4);
  const offset = 6;

  return (
    <div className="relative" style={{ paddingTop: Math.max(behind, 1) * offset, paddingRight: Math.max(behind, 1) * offset }}>
      {Array.from({ length: Math.max(behind, 1) }).map((_, i) => {
        const depth = Math.max(behind, 1) - i;
        return (
          <div
            key={i}
            className={`absolute rounded-2xl border ${
              black ? "border-red-500/25 bg-red-500/[0.06]" : "border-emerald-500/25 bg-emerald-500/[0.06]"
            }`}
            style={{
              top: (Math.max(behind, 1) - depth) * offset,
              right: (Math.max(behind, 1) - depth) * offset,
              left: depth * offset,
              bottom: depth * offset,
              opacity: 1 - (depth - 1) * 0.18,
            }}
          />
        );
      })}
      <div
        className={`relative rounded-2xl border bg-[#14141c] overflow-hidden flex flex-col h-full ${
          black ? "border-red-500/30" : "border-emerald-500/30"
        }`}
      >
        <div className="relative aspect-square bg-white/5">
          {item.photo_url ? (
            <img src={item.photo_url} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl font-semibold text-white/30">
              {initials}
            </div>
          )}
          {item.changes > 0 && (
            <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-black font-medium flex items-center gap-1">
              <Icon name="History" size={11} />изменений: {item.changes}
            </span>
          )}
          <button
            onClick={onScan}
            disabled={scanning}
            title="Сканировать аккаунт"
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white/80 hover:text-white disabled:opacity-60"
          >
            <Icon name={scanning ? "Loader2" : "ScanSearch"} fallback="RefreshCw" size={15} className={scanning ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="p-3 flex-1 flex flex-col gap-1.5">
          <div className="text-sm font-semibold text-white truncate">{item.name || "Без имени"}</div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-1.5 text-white/70">
              <Icon name="Hash" size={12} className="text-white/40 shrink-0" />
              {item.tg_id ? <span className="font-mono">{item.tg_id}</span> : <span className="text-amber-300">ID не найден</span>}
            </div>
            <div className="flex items-center gap-1.5 text-white/70">
              <Icon name="Phone" size={12} className="text-white/40 shrink-0" />
              {item.phone || <span className="text-white/30">—</span>}
            </div>
            <div className="flex items-center gap-1.5 text-sky-300 truncate">
              <Icon name="AtSign" size={12} className="text-white/40 shrink-0" />
              {item.username ? item.username : <span className="text-white/30">—</span>}
            </div>
          </div>
          {black && (item.reason || item.removed_at) && (
            <div className="mt-1 rounded-lg bg-red-500/10 px-2 py-1.5 text-[11px] text-red-200 space-y-0.5">
              {item.reason && <div className="line-clamp-2">{item.reason}</div>}
              {item.removed_at && <div className="text-red-300/70">Удалён {fmtDate(item.removed_at)}</div>}
            </div>
          )}
          {item.last_scan_at && (
            <div className="text-[10px] text-white/35 mt-auto pt-1">
              Скан {fmtDate(item.last_scan_at, true)} · {item.scan_status}
            </div>
          )}
        </div>

        <button
          onClick={onLayers}
          className={`mx-3 mb-2 rounded-xl px-2.5 py-2 text-left text-[11px] flex items-center gap-2 transition-colors ${
            item.last_change ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-200" : "bg-white/[0.04] hover:bg-white/[0.08] text-white/50"
          }`}
        >
          <Icon name="Layers" size={13} className="shrink-0" />
          <span className="flex-1 min-w-0 truncate">
            {item.last_change
              ? `${fmtDate(item.last_change.at)}: ${item.last_change.fields.map((f) => FIELD_LABELS[f] || f).join(", ")}`
              : "Изменений нет"}
          </span>
          <span className="shrink-0 text-white/40">{layers} сл.</span>
        </button>

        <button
          onClick={onEdit}
          className="m-3 mt-0 rounded-xl border border-white/10 py-2 text-xs text-white/80 hover:text-white hover:bg-white/5 flex items-center justify-center gap-1.5"
        >
          <Icon name="Pencil" size={13} />Редактировать
        </button>
      </div>
    </div>
  );
}

export default PersonCard;
