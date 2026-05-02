export interface BotPost {
  id: number;
  photo_url: string;
  greeting: string;
  description: string;
  is_used: boolean;
  scheduled_date: string | null;
  created_at: string;
  last_tg_status?: string | null;
  last_vk_status?: string | null;
  last_sent_at?: string | null;
}

export interface BotInfo {
  username: string;
  webhookStatus: "loading" | "active" | "not_set" | "error";
  loading: boolean;
}

export const BOTS = [
  {
    id: "gift",
    name: "Бот розыгрышей",
    url: "https://functions.poehali.dev/0a298490-7238-4089-bc1d-34880245c186",
    color: "sky",
    icon: "Gift",
    description: "Привязка аккаунта, уведомления о розыгрышах",
    features: [
      { label: "Привязка Telegram к аккаунту", active: true },
      { label: "Уведомления о розыгрышах", active: true },
      { label: "Посты в канал", active: true },
    ],
  },
  {
    id: "site",
    name: "Бот сайта",
    url: "https://functions.poehali.dev/1fa0fa06-91b0-4358-aad7-f62d5aafa444",
    color: "purple",
    icon: "Globe",
    description: "Открывает ug-transfer.online внутри Telegram",
    features: [
      { label: "Web App — сайт внутри Telegram", active: true },
      { label: "Кнопка меню «Открыть сайт»", active: true },
      { label: "Ежедневные посты в @ug_transfer_pro", active: true },
    ],
  },
];

export const colorMap: Record<string, { bg: string; text: string; border: string }> = {
  sky: { bg: "bg-sky-500/10", text: "text-sky-400", border: "border-sky-500/20" },
  purple: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
};
