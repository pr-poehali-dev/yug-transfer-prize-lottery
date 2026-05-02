import Icon from "@/components/ui/icon";
import { SAIT_BOT_DAILY_URL } from "../adminTypes";

interface BotCronStatusProps {
  cronStatus: { working: boolean; lastSent: string | null };
}

export function BotCronStatus({ cronStatus }: BotCronStatusProps) {
  if (cronStatus.working) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
          <Icon name="CheckCircle2" size={20} className="text-emerald-400" />
        </div>
        <div className="min-w-0">
          <p className="text-emerald-300 text-sm font-medium">Автопубликация работает</p>
          <p className="text-white/40 text-xs">Последний пост ушёл {cronStatus.lastSent}. Каждый день в 09:00 МСК очередной пост уходит в Telegram автоматически.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/8 p-6" style={{ background: "rgba(255,255,255,0.02)" }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
          <Icon name="Clock" size={20} className="text-amber-400" />
        </div>
        <div>
          <h3 className="text-white font-medium text-lg">Автопубликация по расписанию</h3>
          <p className="text-white/40 text-xs">Ежедневная отправка в Telegram в 09:00 МСК</p>
        </div>
      </div>

      <div className="space-y-3 text-sm">
        <p className="text-white/60">Чтобы посты отправлялись автоматически каждый день, настрой бесплатный таймер на <a href="https://cron-job.org" target="_blank" rel="noreferrer" className="text-amber-400 hover:underline font-medium">cron-job.org</a>:</p>

        <ol className="space-y-2 text-white/50 pl-1">
          <li className="flex gap-2"><span className="text-amber-400/60 shrink-0">1.</span> Зарегистрируйся на <a href="https://cron-job.org/en/signup/" target="_blank" rel="noreferrer" className="text-amber-400 hover:underline">cron-job.org</a> (бесплатно)</li>
          <li className="flex gap-2"><span className="text-amber-400/60 shrink-0">2.</span> Нажми «Create Cron Job»</li>
          <li className="flex gap-2"><span className="text-amber-400/60 shrink-0">3.</span> Вставь URL:</li>
        </ol>

        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-amber-300 text-xs break-all select-all">{SAIT_BOT_DAILY_URL}</code>
          <button onClick={() => { navigator.clipboard.writeText(SAIT_BOT_DAILY_URL); }} className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white text-xs hover:bg-white/10 transition-colors shrink-0">
            <Icon name="Copy" size={14} />
          </button>
        </div>

        <ol start={4} className="space-y-2 text-white/50 pl-1">
          <li className="flex gap-2"><span className="text-amber-400/60 shrink-0">4.</span> Расписание: <span className="text-white/70 font-medium">Every day at 06:00 UTC</span> (= 09:00 МСК)</li>
          <li className="flex gap-2"><span className="text-amber-400/60 shrink-0">5.</span> Сохрани — готово!</li>
        </ol>

        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-xs text-amber-200 flex items-start gap-2 mt-2">
          <Icon name="Info" size={14} className="shrink-0 mt-0.5" />
          <span>Каждый день в 09:00 МСК очередной пост из списка выше автоматически уйдёт в Telegram. Когда все посты закончатся — цикл начнётся сначала.</span>
        </div>
      </div>
    </div>
  );
}

export default BotCronStatus;
