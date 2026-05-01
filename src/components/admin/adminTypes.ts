export const ADMIN_AUTH_URL = "https://functions.poehali.dev/cc8cbc36-edde-42f3-9196-fbfc8a6e8946";
export const RAFFLES_URL = "https://functions.poehali.dev/39a7b356-ef83-46dd-81a0-581903229de9";
export const ADMIN_STATS_URL = "https://functions.poehali.dev/fa4cc22e-4f17-475f-ab1a-eb15d4c5971b";
export const ADMIN_CLIENTS_URL = "https://functions.poehali.dev/68991b02-f3e2-4903-8cd2-2239bf9116ac";
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
  gradient: GRADIENTS[0], winner: "", target_amount: 0,
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
  winner_phone?: string;
  winner_username?: string;
  photo_url?: string;
  target_amount?: number;
}

export const JACKPOT_URL = "https://functions.poehali.dev/f43fd2b9-63b6-433a-9a57-6c363cea9728";
export const SPIN_URL = "https://functions.poehali.dev/9eba717e-47b3-4a6b-add1-02c8a4a67974";
export const ADMIN_POSTS_URL = "https://functions.poehali.dev/0813e498-5f2e-4090-b643-15c885d057c8";
export const ADMIN_BOT_POSTS_URL = "https://functions.poehali.dev/9578d639-08e5-479c-938a-de950926d149";
export const SAIT_BOT_DAILY_URL = "https://functions.poehali.dev/9f4c8475-f48d-4145-999c-e5cfdabf5d21";
export const UPLOAD_VIDEO_URL = "https://functions.poehali.dev/f6d6a065-4281-4091-ac9e-9e3121bf2571";
export const ADMIN_DRIVER_SUBS_URL = "https://functions.poehali.dev/95d0380a-04e8-4a3c-88db-9c256a11f1f6";

export type AdminTab = "posts" | "bot" | "drivers";

export interface DriverSub {
  id: number;
  telegram_id: number;
  username: string;
  first_name: string;
  plan: string;
  amount_rub: number;
  started_at: string | null;
  expires_at: string | null;
  status: string;
}

export interface Post {
  id: number;
  title: string;
  text: string;
  photo_url: string;
  video_note_url: string;
  button_text: string;
  button_url: string;
  button2_text: string;
  button2_url: string;
  status: "draft" | "scheduled" | "published" | "failed";
  scheduled_at: string | null;
  published_at: string | null;
  telegram_message_id: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface RaffleStat {
  participants: number;
  entries: number;
  total_amount: number;
}

export interface AdminStats {
  users: { total: number; new_week: number; new_month: number };
  payments: { total_amount: number; total_count: number; month_amount: number };
  entries: { total: number };
  raffles: { active: number; total: number };
  raffle_stats: Record<string, RaffleStat>;
}

export interface Client {
  id: number;
  telegram_id: number;
  first_name: string;
  last_name: string;
  username: string;
  phone: string;
  photo_url: string;
  balance: number;
  created_at: string;
  total_paid: number;
  payments_count: number;
  entries_count: number;
}