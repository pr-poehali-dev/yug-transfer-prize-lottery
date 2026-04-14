import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";

interface AdminBotTabProps {
  token: string;
}

const BOTS = [
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
      { label: "Команды бота", active: false },
      { label: "Приём оплаты через бота", active: false },
    ],
  },
];

interface BotInfo {
  username: string;
  webhookStatus: "loading" | "active" | "not_set" | "error";
  loading: boolean;
}

export function AdminBotTab({ token }: AdminBotTabProps) {
  const [bots, setBots] = useState<Record<string, BotInfo>>({
    gift: { username: "", webhookStatus: "loading", loading: true },
    site: { username: "", webhookStatus: "loading", loading: true },
  });

  const fetchBotInfo = async (botId: string, url: string) => {
    try {
      const res = await fetch(`${url}?action=bot_info`, {
        headers: { "X-Admin-Token": token },
      });
      const data = await res.json();
      setBots(prev => ({
        ...prev,
        [botId]: {
          username: data.ok ? data.username : "",
          webhookStatus: data.ok && data.webhook_active ? "active" : data.ok ? "not_set" : "error",
          loading: false,
        },
      }));
    } catch {
      setBots(prev => ({
        ...prev,
        [botId]: { username: "", webhookStatus: "error", loading: false },
      }));
    }
  };

  const handleSetWebhook = async (botId: string, url: string) => {
    setBots(prev => ({ ...prev, [botId]: { ...prev[botId], webhookStatus: "loading" } }));
    try {
      const res = await fetch(`${url}?action=set_webhook&url=${encodeURIComponent(url)}`, {
        headers: { "X-Admin-Token": token },
      });
      const data = await res.json();
      setBots(prev => ({
        ...prev,
        [botId]: { ...prev[botId], webhookStatus: data.ok ? "active" : "error" },
      }));
    } catch {
      setBots(prev => ({
        ...prev,
        [botId]: { ...prev[botId], webhookStatus: "error" },
      }));
    }
  };

  useEffect(() => {
    BOTS.forEach(b => fetchBotInfo(b.id, b.url));
  }, []);

  const colorMap: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    sky: { bg: "bg-sky-500/10", text: "text-sky-400", border: "border-sky-500/20", dot: "bg-sky-400" },
    purple: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20", dot: "bg-purple-400" },
  };

  return (
    <div>
      <h2 className="font-oswald text-3xl font-bold text-white mb-6">Наши боты</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {BOTS.map(bot => {
          const info = bots[bot.id];
          const c = colorMap[bot.color];

          return (
            <div key={bot.id} className="space-y-4">
              <div className="rounded-2xl border border-white/8 p-5" style={{ background: "rgba(255,255,255,0.02)" }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
                    <Icon name={bot.icon} size={20} className={c.text} />
                  </div>
                  <div>
                    <h3 className="text-white font-medium">{bot.name}</h3>
                    <p className="text-white/40 text-xs">{bot.description}</p>
                  </div>
                </div>

                {info.loading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-white/3 border border-white/5">
                      <span className="text-white/50 text-sm">Юзернейм</span>
                      {info.username ? (
                        <a href={`https://t.me/${info.username}`} target="_blank" rel="noreferrer"
                          className={`${c.text} text-sm font-medium hover:underline`}>
                          @{info.username}
                        </a>
                      ) : (
                        <span className="text-white/30 text-sm">Не настроен</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-white/3 border border-white/5">
                      <span className="text-white/50 text-sm">Webhook</span>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${info.webhookStatus === "active" ? "bg-emerald-400" : info.webhookStatus === "error" ? "bg-red-400" : "bg-white/20"}`} />
                        <span className={`text-sm ${info.webhookStatus === "active" ? "text-emerald-400" : info.webhookStatus === "error" ? "text-red-400" : "text-white/30"}`}>
                          {info.webhookStatus === "active" ? "Активен" : info.webhookStatus === "error" ? "Ошибка" : info.webhookStatus === "loading" ? "..." : "Не установлен"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-white/3 border border-white/5">
                      <span className="text-white/50 text-sm">Ссылка</span>
                      {info.username ? (
                        <a href={`https://t.me/${info.username}`} target="_blank" rel="noreferrer"
                          className="text-white/60 text-sm hover:text-white transition-colors">
                          t.me/{info.username}
                        </a>
                      ) : (
                        <span className="text-white/30 text-sm">—</span>
                      )}
                    </div>

                    {info.webhookStatus !== "active" && info.webhookStatus !== "loading" && (
                      <button onClick={() => handleSetWebhook(bot.id, bot.url)}
                        className={`w-full py-2.5 rounded-xl ${c.bg} hover:opacity-80 ${c.text} text-sm font-medium transition-colors border ${c.border}`}>
                        Установить Webhook
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-white/8 p-5" style={{ background: "rgba(255,255,255,0.02)" }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
                    <Icon name="Zap" size={16} className={c.text} />
                  </div>
                  <span className="text-white/70 text-sm font-medium">Возможности</span>
                </div>
                <div className="space-y-2">
                  {bot.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-white/3 border border-white/5">
                      <Icon name={f.active ? "CheckCircle2" : "Circle"} size={14}
                        className={f.active ? "text-emerald-400" : "text-white/15"} />
                      <span className={`text-sm ${f.active ? "text-white/70" : "text-white/30"}`}>{f.label}</span>
                      {!f.active && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 ml-auto">скоро</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AdminBotTab;