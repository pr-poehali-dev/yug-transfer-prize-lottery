export const CABINET_URL = "https://functions.poehali.dev/0ad2d0a9-bb39-4116-9934-9460e7841500";
export const AUTH_URL = "https://functions.poehali.dev/3668a161-208c-46c4-8691-84fa9d9586b0";
export const AUTH_LINK_URL = "https://functions.poehali.dev/3668a161-208c-46c4-8691-84fa9d9586b0";
export const TG_BOT_ID = 8567041422;

export interface Entry {
  id: number;
  raffle_title: string;
  raffle_prize: string;
  raffle_icon: string;
  raffle_photo?: string | null;
  raffle_status: string;
  winner: string | null;
  tickets: number;
  amount: number;
  created_at: string;
}

export interface Transaction {
  id: number;
  type: string;
  amount: number;
  description: string;
  status: string;
  created_at: string;
}

export interface TgUser {
  id: number;
  first_name: string;
  username?: string;
  hash: string;
  auth_date: number;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}