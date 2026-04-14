import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";

interface AdminBotTabProps {
  token: string;
}

const TELEGRAM_BOT_URL = "https://functions.poehali.dev/0a298490-7238-4089-bc1d-34880245c186";

export function AdminBotTab({ token }: AdminBotTabProps) {
  const [botUsername, setBotUsername] = useState("");
  const [webhookStatus, setWebhookStatus] = useState<"loading" | "active" | "not_set" | "error">("loading");
  const [loading, setLoading] = useState(true);

  const fetchBotInfo = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${TELEGRAM_BOT_URL}?action=bot_info`, {
        headers: { "X-Admin-Token": token },
      });
      const data = await res.json();
      if (data.ok && data.username) {
        setBotUsername(data.username);
        setWebhookStatus("active");
      } else {
        setWebhookStatus("not_set");
      }
    } catch {
      setWebhookStatus("error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBotInfo(); }, []);

  const handleSetWebhook = async () => {
    setWebhookStatus("loading");
    try {
      const res = await fetch(`${TELEGRAM_BOT_URL}?action=set_webhook&url=${encodeURIComponent(TELEGRAM_BOT_URL)}`, {
        headers: { "X-Admin-Token": token },
      });
      const data = await res.json();
      if (data.ok) {
        setWebhookStatus("active");
      } else {
        setWebhookStatus("error");
      }
    } catch {
      setWebhookStatus("error");
    }
  };

  return (
    <div>
      <h2 className="font-oswald text-3xl font-bold text-white mb-6">
        Наш бот
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/8 p-5" style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center">
                <Icon name="Bot" size={20} className="text-sky-400" />
              </div>
              <div>
                <h3 className="text-white font-medium">Telegram-бот</h3>
                <p className="text-white/40 text-xs">Настройки и статус</p>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-white/3 border border-white/5">
                  <span className="text-white/50 text-sm">Юзернейм</span>
                  {botUsername ? (
                    <a
                      href={`https://t.me/${botUsername}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-400 text-sm font-medium hover:underline"
                    >
                      @{botUsername}
                    </a>
                  ) : (
                    <span className="text-white/30 text-sm">Не настроен</span>
                  )}
                </div>

                <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-white/3 border border-white/5">
                  <span className="text-white/50 text-sm">Webhook</span>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${webhookStatus === "active" ? "bg-emerald-400" : webhookStatus === "error" ? "bg-red-400" : "bg-white/20"}`} />
                    <span className={`text-sm ${webhookStatus === "active" ? "text-emerald-400" : webhookStatus === "error" ? "text-red-400" : "text-white/30"}`}>
                      {webhookStatus === "active" ? "Активен" : webhookStatus === "error" ? "Ошибка" : webhookStatus === "loading" ? "..." : "Не установлен"}
                    </span>
                  </div>
                </div>

                {webhookStatus !== "active" && webhookStatus !== "loading" && (
                  <button
                    onClick={handleSetWebhook}
                    className="w-full py-2.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-sm font-medium transition-colors border border-sky-500/20"
                  >
                    Установить Webhook
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/8 p-5" style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Icon name="Zap" size={20} className="text-purple-400" />
              </div>
              <div>
                <h3 className="text-white font-medium">Возможности</h3>
                <p className="text-white/40 text-xs">Что умеет бот</p>
              </div>
            </div>

            <div className="space-y-2">
              {[
                { icon: "Link", label: "Привязка Telegram к аккаунту", status: true },
                { icon: "Bell", label: "Уведомления о розыгрышах", status: true },
                { icon: "Send", label: "Посты в канал", status: true },
                { icon: "MessageSquare", label: "Команды бота", status: false, soon: true },
                { icon: "Users", label: "Меню с кнопками", status: false, soon: true },
                { icon: "ShoppingCart", label: "Приём оплаты через бота", status: false, soon: true },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-white/3 border border-white/5">
                  <Icon name={item.icon} size={15} className={item.status ? "text-emerald-400" : "text-white/20"} />
                  <span className={`text-sm flex-1 ${item.status ? "text-white/70" : "text-white/30"}`}>{item.label}</span>
                  {item.status ? (
                    <Icon name="CheckCircle2" size={14} className="text-emerald-400" />
                  ) : item.soon ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400">скоро</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/8 p-5" style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <Icon name="Terminal" size={20} className="text-orange-400" />
              </div>
              <div>
                <h3 className="text-white font-medium">Команды бота</h3>
                <p className="text-white/40 text-xs">Текущие команды</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-white/3 border border-white/5">
                <code className="text-sky-400 text-sm font-mono">/start</code>
                <span className="text-white/40 text-sm">Приветствие + привязка аккаунта</span>
              </div>
            </div>

            <p className="text-white/25 text-xs mt-4">
              Новые команды и меню будут добавлены в следующем обновлении.
            </p>
          </div>

          <div className="rounded-2xl border border-dashed border-purple-500/20 p-6 text-center" style={{ background: "rgba(139,92,246,0.03)" }}>
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-3">
              <Icon name="Rocket" size={24} className="text-purple-400" />
            </div>
            <h3 className="text-white font-medium mb-2">Новый бот</h3>
            <p className="text-white/40 text-sm mb-4 max-w-xs mx-auto">
              Здесь мы будем настраивать функции нового бота: меню, команды, оплата, авто-ответы
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminBotTab;