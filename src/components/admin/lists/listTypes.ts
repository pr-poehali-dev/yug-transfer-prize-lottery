import { KNOWLEDGE_BASE_URL, KB_BOT_URL, TG_LOOKUP_URL } from "../adminTypes";

export type Role = "driver" | "dispatcher" | "";
export type ListType = "white" | "black" | "pending";

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
  layers: number;
  last_change: { fields: string[]; at: string; source: string } | null;
}

export interface Snapshot {
  id: number;
  tg_id: number | null;
  name: string;
  username: string;
  phone: string;
  bio: string;
  photo_url: string;
  source: string;
  changed: string[];
  created_at: string;
}

export const FIELD_LABELS: Record<string, string> = {
  name: "имя",
  username: "username",
  phone: "телефон",
  tg_id: "ID",
  photo_url: "фото",
  bio: "описание",
};

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
export const SNAPSHOTS_API = `${KNOWLEDGE_BASE_URL}?entity=snapshots`;
export const LOOKUP_API = `${KNOWLEDGE_BASE_URL}?entity=lookup`;
export const UPLOAD_API = `${KNOWLEDGE_BASE_URL}?entity=upload_photo`;
export const SCAN_API = `${KB_BOT_URL}?action=scan`;
export const TG_LOOKUP_API = TG_LOOKUP_URL;
export const BULK_IMPORT_API = `${KNOWLEDGE_BASE_URL}?entity=bulk_import`;

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

export function detectQuery(raw: string): { field: "username" | "phone" | "tg_id"; value: string } | null {
  const v = raw.trim();
  if (!v) return null;
  const link = v.match(/^(?:https?:\/\/)?t\.me\/([A-Za-z0-9_]{4,})/i);
  if (link) return { field: "username", value: link[1] };
  if (v.startsWith("@")) return { field: "username", value: v.slice(1) };
  const compact = v.replace(/[\s\-()]/g, "");
  if (/^\+?\d{5,15}$/.test(compact)) {
    const d = compact.replace("+", "");
    const isPhone = compact.startsWith("+") || (d.length === 11 && /^[78]/.test(d)) || (d.length === 10 && d.startsWith("9"));
    return isPhone ? { field: "phone", value: compact.startsWith("+") ? compact : `+${d.length === 10 ? "7" + d : d.replace(/^8/, "7")}` } : { field: "tg_id", value: d };
  }
  if (/^[A-Za-z][A-Za-z0-9_]{3,}$/.test(v)) return { field: "username", value: v };
  return null;
}
