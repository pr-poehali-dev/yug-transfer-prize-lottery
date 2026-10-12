import { useState } from "react";
import Icon from "@/components/ui/icon";
import { GroupsBadge } from "./GroupsBadge";
import { LISTS, ListItem } from "./listTypes";
import { TgLink } from "./TgLink";

const SHORT: Record<string, string> = {
  "dispatcher-white": "Белый · диспетчер",
  "dispatcher-black": "Чёрный · диспетчер",
  "driver-white": "Белый · водитель",
  "driver-black": "Чёрный · водитель",
};

interface Props {
  item: ListItem;
  busy: boolean;
  scanning: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onOpen: (item: ListItem) => void;
  onScan: (item: ListItem) => void;
  onRemove: (item: ListItem, forever: boolean) => void;
  onAssign: (item: ListItem, role: string, list_type: string) => void;
}

export function ModerationCard({ item: i, busy, scanning, menuOpen, onToggleMenu, onOpen, onScan, onRemove, onAssign }: Props) {
  const [confirmDel, setConfirmDel] = useState(false);
  return (
    <div className="relative rounded-xl border border-white/10 space-card p-2.5">
      <div className="flex gap-2.5">
        <button onClick={() => (i.photo_url ? onOpen(i) : onScan(i))} disabled={scanning}
          title={i.photo_url ? "Открыть карточку" : "Нажмите — подтянуть данные из Telegram"}
          className="group/av relative w-14 h-14 rounded-lg bg-white/5 overflow-hidden shrink-0 flex items-center justify-center">
          {i.photo_url ? (
            <img loading="lazy" decoding="async" src={i.photo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <img loading="lazy" decoding="async" src="/avatar-placeholder.jpg" alt="" className="w-full h-full object-cover" />
          )}
          {!i.photo_url && (
            <span className={`absolute inset-0 flex items-center justify-center bg-sky-500/20 text-sky-200 transition-opacity ${
              scanning ? "opacity-100" : "opacity-0 group-hover/av:opacity-100"}`}>
              <Icon name={scanning ? "Loader2" : "ScanSearch"} fallback="RefreshCw" size={18}
                className={scanning ? "animate-spin" : ""} />
            </span>
          )}
        </button>
        <div className="flex-1 min-w-0 text-[11px] space-y-0.5 cursor-pointer" onClick={() => !scanning && onScan(i)}
          title="Нажмите — подтянуть данные из Telegram">
          <div className="text-xs font-semibold text-white truncate">{i.name || "Без имени"}</div>
          <div className="text-white/50 font-mono truncate">{i.tg_id ? `ID ${i.tg_id}` : "ID —"}</div>
          <div className="text-white/50 truncate">{i.phone || "—"}</div>
          <div className="text-sky-300 truncate">{i.username ? <TgLink username={i.username} /> : "—"}</div>
          <GroupsBadge groups={i.groups} />
        </div>
        <div className="self-start flex flex-col gap-1">
          <button onClick={() => setConfirmDel((v) => !v)} title="Удалить" className="p-1 rounded text-white/30 hover:text-red-400">
            <Icon name="X" size={13} />
          </button>
          <button onClick={() => onScan(i)} disabled={scanning} title="Подтянуть данные из Telegram"
            className="p-1 rounded text-sky-300/70 hover:text-sky-200 hover:bg-sky-500/10 disabled:opacity-70">
            <Icon name={scanning ? "Loader2" : "ScanSearch"} fallback="RefreshCw" size={14}
              className={scanning ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {confirmDel && (
        <div className="mt-2 rounded-lg border border-red-500/25 bg-red-500/[0.06] p-2 space-y-1.5">
          <div className="text-[11px] text-white/60">Удалить карточку?</div>
          <div className="grid grid-cols-2 gap-1.5">
            <button onClick={() => { setConfirmDel(false); onRemove(i, false); }}
              title="Убрать с модерации. При следующем сканировании группы может появиться снова"
              className="rounded-md px-2 py-1.5 text-[11px] border border-white/15 text-white/80 hover:bg-white/5">
              С модерации
            </button>
            <button onClick={() => { setConfirmDel(false); onRemove(i, true); }}
              title="Удалить из базы и больше никогда не добавлять при сканировании"
              className="rounded-md px-2 py-1.5 text-[11px] bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center gap-1">
              <Icon name="Trash2" size={11} />Из базы навсегда
            </button>
          </div>
          <button onClick={() => setConfirmDel(false)} className="w-full text-[11px] text-white/40 hover:text-white/70">Отмена</button>
        </div>
      )}

      <button
        onClick={onToggleMenu}
        disabled={busy}
        className="mt-2 w-full rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 text-xs py-1.5 flex items-center justify-center gap-1.5 disabled:opacity-60"
      >
        <Icon name={busy ? "Loader2" : "Tag"} size={12} className={busy ? "animate-spin" : ""} />
        Присвоить статус
        <Icon name="ChevronDown" size={12} className={`transition-transform ${menuOpen ? "rotate-180" : ""}`} />
      </button>

      {menuOpen && (
        <div className="mt-1.5 grid grid-cols-2 gap-1">
          {LISTS.map((l) => {
            const black = l.list_type === "black";
            return (
              <button
                key={`${l.role}-${l.list_type}`}
                onClick={() => onAssign(i, l.role, l.list_type)}
                className={`rounded-md px-1.5 py-1.5 text-[10px] leading-tight border ${
                  black
                    ? "border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                }`}
              >
                {SHORT[`${l.role}-${l.list_type}`]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ModerationCard;
