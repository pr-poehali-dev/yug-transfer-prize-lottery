export type Section = "raffles" | "cabinet" | "history" | "contacts";
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
}

export const RAFFLES: Raffle[] = [
  {
    id: 1,
    title: "Мегапризёр — iPhone 16 Pro",
    prize: "iPhone 16 Pro Max",
    prizeIcon: "Smartphone",
    endDate: "2026-04-30",
    participants: 2847,
    minAmount: 500,
    status: "active",
    gradient: "from-purple-600 via-pink-500 to-orange-400",
  },
  {
    id: 2,
    title: "Путешествие мечты",
    prize: "Тур в Дубай на двоих",
    prizeIcon: "Plane",
    endDate: "2026-05-15",
    participants: 1203,
    minAmount: 1000,
    status: "active",
    gradient: "from-cyan-500 via-blue-500 to-purple-600",
  },
  {
    id: 3,
    title: "Авто-розыгрыш",
    prize: "Kia K5 2025",
    prizeIcon: "Car",
    endDate: "2026-06-01",
    participants: 5621,
    minAmount: 2000,
    status: "upcoming",
    gradient: "from-orange-500 via-red-500 to-pink-600",
  },
  {
    id: 4,
    title: "Гаджет-пак",
    prize: "AirPods Pro + iPad",
    prizeIcon: "Headphones",
    endDate: "2026-03-31",
    participants: 3100,
    minAmount: 300,
    status: "ended",
    gradient: "from-green-500 via-teal-500 to-cyan-500",
    winner: "Алексей К.",
  },
  {
    id: 5,
    title: "Деньги — наличными",
    prize: "500 000 ₽",
    prizeIcon: "Banknote",
    endDate: "2026-04-20",
    participants: 9988,
    minAmount: 100,
    status: "active",
    gradient: "from-yellow-400 via-orange-400 to-red-500",
  },
  {
    id: 6,
    title: "PlayStation 5",
    prize: "PS5 + 5 игр",
    prizeIcon: "Gamepad2",
    endDate: "2026-02-28",
    participants: 4200,
    minAmount: 250,
    status: "ended",
    gradient: "from-blue-600 via-indigo-600 to-purple-600",
    winner: "Мария Т.",
  },
];

export const HISTORY = [
  { id: 1, raffle: "Гаджет-пак", date: "31.03.2026", amount: 300, tickets: 3, status: "Не выиграл" },
  { id: 2, raffle: "Мегапризёр — iPhone 16 Pro", date: "10.04.2026", amount: 1000, tickets: 2, status: "Участвую" },
  { id: 3, raffle: "Деньги — наличными", date: "09.04.2026", amount: 500, tickets: 5, status: "Участвую" },
  { id: 4, raffle: "PlayStation 5", date: "20.02.2026", amount: 250, tickets: 1, status: "Не выиграл" },
  { id: 5, raffle: "Путешествие мечты", date: "12.04.2026", amount: 2000, tickets: 2, status: "Участвую" },
];

export const NAV_ITEMS = [
  { id: "raffles" as Section, label: "Розыгрыши", icon: "Gift" },
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
