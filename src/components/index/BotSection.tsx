import Icon from "@/components/ui/icon";
import { SectionHeader } from "./shared";

export function BotSection() {
  return (
    <div>
      <SectionHeader
        title="Telegram-бот"
        subtitle="Космическая капсула связи с диспетчером"
        icon="Bot"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-glow rounded-2xl p-8 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="relative z-10">
            <div className="w-16 h-16 mb-5 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg animate-pulse-glow">
              <Icon name="Bot" size={32} className="text-white" />
            </div>
            <h3 className="font-oswald text-3xl font-bold text-white mb-3">@ug_sait_bot</h3>
            <p className="text-muted-foreground mb-6">
              Открой бота — и получай ежедневные посты с актуальными контактами,
              новостями и спецпредложениями ЮГ ТРАНСФЕР.
            </p>
            <a
              href="https://t.me/ug_sait_bot"
              target="_blank"
              rel="noreferrer"
              className="grad-btn rounded-xl px-6 py-3.5 font-semibold inline-flex items-center gap-2"
            >
              <Icon name="Send" size={18} />
              Открыть бота
            </a>
          </div>
        </div>

        <div className="card-glow rounded-2xl p-8">
          <h3 className="font-oswald text-2xl font-bold text-white mb-5">Что умеет бот</h3>
          <div className="space-y-3">
            {[
              { icon: "Zap", text: "Мгновенно соединяет с диспетчером" },
              { icon: "Calendar", text: "Ежедневные посты с акциями и контактами" },
              { icon: "MessageCircle", text: "Ответы на вопросы 24/7" },
              { icon: "Bell", text: "Уведомления о новых направлениях" },
            ].map((f) => (
              <div key={f.text} className="glass rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                  <Icon name={f.icon} size={18} className="text-white" fallback="Circle" />
                </div>
                <p className="text-sm text-white">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
