import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";

const JACKPOT_URL = "https://functions.poehali.dev/f43fd2b9-63b6-433a-9a57-6c363cea9728";

interface JackpotData {
  balance: number;
  next_draw_at: string | null;
  last_winner: string | null;
  last_draw_at: string | null;
}

function useCountdown(targetDate: string | null) {
  const [time, setTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!targetDate) return;
    const tick = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) { setTime({ days: 0, hours: 0, minutes: 0, seconds: 0 }); return; }
      setTime({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  return time;
}

function TimerBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div className="absolute -inset-1 bg-gradient-to-br from-yellow-500/40 to-orange-500/40 rounded-2xl blur-md" />
        <div className="relative glass border border-yellow-500/20 rounded-2xl w-20 h-20 md:w-24 md:h-24 flex items-center justify-center">
          <span className="font-oswald text-3xl md:text-4xl font-bold text-white">
            {String(value).padStart(2, "0")}
          </span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground mt-2 uppercase tracking-wider">{label}</span>
    </div>
  );
}

export function JackpotSection() {
  const [data, setData] = useState<JackpotData | null>(null);
  const [loading, setLoading] = useState(true);
  const countdown = useCountdown(data?.next_draw_at || null);

  useEffect(() => {
    fetch(JACKPOT_URL)
      .then(r => r.json())
      .then(d => { if (d.ok) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const balance = data?.balance ?? 0;
  const nextDrawAt = data?.next_draw_at ? new Date(data.next_draw_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Главная карточка */}
      <div className="relative rounded-3xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-900/60 via-orange-900/40 to-purple-900/60" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-yellow-500/20 via-transparent to-transparent" />
        <div className="absolute top-4 right-4 text-6xl opacity-20 select-none">💎</div>
        <div className="absolute bottom-4 left-4 text-4xl opacity-10 select-none">✨</div>

        <div className="relative glass border border-yellow-500/20 rounded-3xl p-8 md:p-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-xs text-yellow-400 uppercase tracking-widest font-semibold">Накоплено</span>
          </div>

          {loading ? (
            <div className="h-16 flex items-center">
              <div className="w-8 h-8 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="mb-6">
              <p className="font-oswald text-5xl md:text-7xl font-bold leading-none"
                style={{ background: "linear-gradient(135deg, #fbbf24, #f97316, #ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {balance.toLocaleString("ru")} ₽
              </p>
              <p className="text-muted-foreground mt-2 text-sm">
                Участвуют все, кто купил хотя бы 1 билет в любом розыгрыше
              </p>
            </div>
          )}

          {/* Таймер */}
          {data?.next_draw_at && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">До розыгрыша</p>
              <div className="flex gap-3">
                <TimerBlock value={countdown.days} label="Дней" />
                <TimerBlock value={countdown.hours} label="Часов" />
                <TimerBlock value={countdown.minutes} label="Минут" />
                <TimerBlock value={countdown.seconds} label="Секунд" />
              </div>
              {nextDrawAt && (
                <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1.5">
                  <Icon name="Calendar" size={13} />
                  Дата розыгрыша: {nextDrawAt}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Как работает */}
      <div className="glass rounded-3xl p-6">
        <h3 className="font-oswald text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Icon name="Info" size={20} className="text-purple-400" />
          Как работает джекпот
        </h3>
        <div className="space-y-3">
          {[
            { icon: "Ticket", text: "Участвуй хотя бы в одном розыгрыше — и ты автоматически в игре за джекпот" },
            { icon: "Calendar", text: "Розыгрыш проводится два раза в год — победитель выбирается случайно" },
            { icon: "Gem", text: "Победитель получает всю накопленную сумму джекпота" },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <Icon name={item.icon as "Ticket"} size={15} className="text-yellow-400" />
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Последний победитель */}
      {data?.last_winner && (
        <div className="glass rounded-3xl p-6 border border-yellow-500/20 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-orange-500/5 pointer-events-none" />
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Последний победитель</p>
          <div className="flex items-center gap-3 relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-2xl">
              🏆
            </div>
            <div>
              <p className="font-oswald text-xl font-bold text-white">{data.last_winner}</p>
              {data.last_draw_at && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(data.last_draw_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              )}
            </div>
            <span className="ml-auto text-xs px-3 py-1.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-bold">ПОБЕДИТЕЛЬ</span>
          </div>
        </div>
      )}
    </div>
  );
}