export type Section = "raffles" | "cabinet" | "history" | "contacts" | "jackpot";
export type RaffleStatus = "all" | "active" | "ended" | "upcoming";

export interface Raffle {
  id: number;
  title: string;
  prize: string;
  prizeIcon: string;
  endDate: string;
  participants: number;
  minAmount: number;
  status: "active" | "ended" | "upcoming";
  gradient: string;
  winner?: string;
  photoUrl?: string;
}

export const RAFFLES: Raffle[] = [];

export const HISTORY: { id: number; raffle: string; date: string; amount: number; tickets: number; status: string }[] = [];

export const NAV_ITEMS = [
  { id: "raffles" as Section, label: "Розыгрыши", icon: "Gift" },
  { id: "jackpot" as Section, label: "Джекпот", icon: "Gem" },
  { id: "cabinet" as Section, label: "Кабинет", icon: "User" },
  { id: "history" as Section, label: "История", icon: "Clock" },
  { id: "contacts" as Section, label: "Контакты", icon: "MessageCircle" },
];

export const TICKER_ITEMS = [
  "🎉 Алексей К. выиграл AirPods Pro",
  "🏆 Новый розыгрыш — Kia K5 2025",
  "🔥 9 988 участников в кэш-розыгрыше",
  "✈️ Мария Т. летит в Дубай",
  "💎 Розыгрыш iPhone — активен до 30 апреля",
];