import { KNOWLEDGE_BASE_URL, KB_BOT_URL, TG_LOOKUP_URL } from "../adminTypes";

export type Role = "driver" | "dispatcher";
export type ListType = "white" | "black";

export interface ListItem {
  id: number;
  role: Role;
  list_type: ListType;
  name: string;
  username: string;
  phone: string;
  note: string;
  tg_id: number | null;
  photo_url: string;
  bio: string;
  reason: string;
  removed_at: string | null;
  last_scan_at: string | null;
  scan_status: string;
  updated_at: string | null;
  changes: number;
}

export interface HistoryItem {
  field: string;
  label: string;
  old: string;
  new: string;
  source: string;
  changed_at: string;
}

export interface ListDef {
  role: Role;
  list_type: ListType;
  title: string;
  icon: string;
  color: string;
}

export const LISTS: ListDef[] = [
  { role: "dispatcher", list_type: "white", title: "Белый список диспетчеров", icon: "ShieldCheck", color: "text-emerald-400" },
  { role: "dispatcher", list_type: "black", title: "Чёрный список диспетчеров", icon: "ShieldX", color: "text-red-400" },
  { role: "driver", list_type: "white", title: "Белый список водителей", icon: "ShieldCheck", color: "text-emerald-400" },
  { role: "driver", list_type: "black", title: "Чёрный список водителей", icon: "ShieldX", color: "text-red-400" },
];

export const LISTS_API = `${KNOWLEDGE_BASE_URL}?entity=lists`;
export const HISTORY_API = `${KNOWLEDGE_BASE_URL}?entity=history`;
export const LOOKUP_API = `${KNOWLEDGE_BASE_URL}?entity=lookup`;
export const UPLOAD_API = `${KNOWLEDGE_BASE_URL}?entity=upload_photo`;
export const SCAN_API = `${KB_BOT_URL}?action=scan`;
export const TG_LOOKUP_API = TG_LOOKUP_URL;

export const inputCls =
  "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-purple-400/60";

export const fmtDate = (v: string | null | undefined, withTime = false) => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return withTime
    ? d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("ru-RU");
};
