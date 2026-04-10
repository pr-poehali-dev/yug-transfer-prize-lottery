export const ADMIN_AUTH_URL = "https://functions.poehali.dev/cc8cbc36-edde-42f3-9196-fbfc8a6e8946";
export const RAFFLES_URL = "https://functions.poehali.dev/39a7b356-ef83-46dd-81a0-581903229de9";
export const ADMIN_STATS_URL = "https://functions.poehali.dev/fa4cc22e-4f17-475f-ab1a-eb15d4c5971b";
export const ADMIN_CLIENTS_URL = "https://functions.poehali.dev/68991b02-f3e2-4903-8cd2-2239bf9116ac";
export const ADMIN_NOTIFY_URL = "https://functions.poehali.dev/b8105351-4e67-40ce-a46c-7a2e2d9ccad0";
export const PUSH_URL = "https://functions.poehali.dev/0b609b6c-8c5c-4291-8ad1-6f757c5a438b";
export const SESSION_KEY = "admin_token";

export const GRADIENTS = [
  "from-purple-600 via-pink-500 to-orange-400",
  "from-cyan-500 via-blue-500 to-purple-600",
  "from-orange-500 via-red-500 to-pink-600",
  "from-green-500 via-teal-500 to-cyan-500",
  "from-yellow-400 via-orange-400 to-red-500",
  "from-blue-600 via-indigo-600 to-purple-600",
];

export const ICONS = ["Gift", "Smartphone", "Plane", "Car", "Headphones", "Banknote", "Gamepad2", "Trophy", "Star", "Zap"];

export const EMPTY_FORM = {
  title: "", prize: "", prize_icon: "Gift", end_date: "",
  participants: 0, min_amount: 100, status: "active" as const,
  gradient: GRADIENTS[0], winner: "",
};

export interface RaffleDB {
  id: number;
  title: string;
  prize: string;
  prize_icon: string;
  end_date: string;
  participants: number;
  min_amount: number;
  status: "active" | "ended" | "upcoming";
  gradient: string;
  winner?: string;
  photo_url?: string;
}

export type AdminTab = "dashboard" | "raffles" | "clients" | "notify";

export interface AdminStats {
  users: { total: number; new_week: number; new_month: number };
  payments: { total_amount: number; total_count: number; month_amount: number };
  entries: { total: number };
  raffles: { active: number; total: number };
}

export interface Client {
  id: number;
  telegram_id: number;
  first_name: string;
  last_name: string;
  username: string;
  photo_url: string;
  balance: number;
  created_at: string;
  total_paid: number;
  payments_count: number;
  entries_count: number;
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  sent_at: string;
  recipients_count: number;
}