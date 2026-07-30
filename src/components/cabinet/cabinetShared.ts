export const TOKEN_KEY = "client_token";
export const SUPPORT_TG = "https://t.me/Dispether82";

export const SITE_PHONE = "+7 (978) 109-28-75";
export const LINK_TG = "https://t.me/Dispether82";
export const LINK_WA = "https://wa.me/79781092875";
export const LINK_MAX = "https://max.ru/+79781092875";
export const CAR_IMG = "https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/2c34d055-d0da-42c2-a689-f53d909b6c3c.jpg";

export const TARIFFS = ["Срочный", "Стандарт", "Комфорт", "Минивэн", "Бизнес", "Доставка"];
export const COUNTS = ["1", "2", "3", "4", "5", "6", "7", "8"];

export interface ClientRequest {
  id: number;
  from_city: string;
  to_city: string;
  trip_date: string;
  trip_time: string;
  people: string;
  baggage: string;
  tariff: string;
  child_seat: boolean;
  booster: boolean;
  animals: boolean;
  comment: string;
  status: string;
  status_label: string;
  created_at: string;
}

export type Tab = "dashboard" | "trips" | "new" | "bonus" | "payment" | "profile" | "settings" | "review";

export const STATUS_STYLE: Record<string, string> = {
  new: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  processing: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  confirmed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  done: "bg-teal-500/15 text-teal-300 border-teal-500/30",
  cancelled: "bg-red-500/15 text-red-300 border-red-500/30",
};

export const ACTIVE = ["new", "processing", "confirmed"];

export const fieldCls =
  "w-full bg-black/40 border border-amber-500/20 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm outline-none focus:border-amber-500/60 transition-colors";
export const inputCls =
  "w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/40 text-sm outline-none focus:border-amber-500/60 transition-colors [color-scheme:dark]";

export const NAV: { key: Tab; icon: string; label: string; soon?: boolean }[] = [
  { key: "dashboard", icon: "LayoutGrid", label: "Главная" },
  { key: "trips", icon: "MapPinned", label: "Мои поездки" },
  { key: "new", icon: "Plus", label: "Новый заказ" },
  { key: "bonus", icon: "Gift", label: "Бонусы и кэшбэк" },
  { key: "payment", icon: "CreditCard", label: "Способы оплаты", soon: true },
  { key: "profile", icon: "UserRound", label: "Профиль" },
  { key: "settings", icon: "Settings", label: "Настройки", soon: true },
];