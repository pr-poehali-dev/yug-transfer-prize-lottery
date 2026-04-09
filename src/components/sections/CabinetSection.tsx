import Icon from "@/components/ui/icon";
import { RAFFLES } from "@/components/raffle-types";
import { CountdownTimer } from "@/components/sections/RafflesSection";

export function CabinetSection() {
  const myRaffles = RAFFLES.filter((r) => r.status === "active").slice(0, 3);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="glass rounded-3xl p-6 mb-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-cyan-500/10 pointer-events-none" />
        <div className="flex items-center gap-5 relative">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl animate-float">
              😎
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full border-2 border-background" />
          </div>
          <div>
            <h2 className="font-oswald text-2xl font-bold text-white">Иван Петров</h2>
            <p className="text-muted-foreground text-sm mb-2">ivan.petrov@mail.ru</p>
            <span className="text-xs px-3 py-1 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-300 border border-yellow-500/30 font-medium">
              ⭐ Премиум участник
            </span>
          </div>
          <div className="ml-auto text-right hidden md:block">
            <p className="text-muted-foreground text-xs mb-1">Баланс</p>
            <p className="font-oswald text-3xl font-bold grad-text">12 450 ₽</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Участий", value: "47", icon: "Ticket", color: "from-purple-500 to-pink-500" },
          { label: "Побед", value: "3", icon: "Trophy", color: "from-yellow-500 to-orange-500" },
          { label: "Потрачено", value: "24 850 ₽", icon: "CreditCard", color: "from-cyan-500 to-blue-500" },
          { label: "Выиграно", value: "78 000 ₽", icon: "Banknote", color: "from-green-500 to-emerald-500" },
        ].map((s, i) => (
          <div
            key={s.label}
            className="card-glow rounded-2xl p-4 text-center opacity-0-init animate-fade-in-up"
            style={{ animationDelay: `${i * 0.1}s`, animationFillMode: "forwards" }}
          >
            <div className={`w-10 h-10 mx-auto mb-3 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center`}>
              <Icon name={s.icon as string} size={18} className="text-white" fallback="Star" />
            </div>
            <p className="font-oswald text-xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="card-glow rounded-2xl p-5">
        <h3 className="font-oswald text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Icon name="Zap" size={20} className="text-yellow-400" />
          Мои активные участия
        </h3>
        <div className="space-y-3">
          {myRaffles.map((r) => (
            <div key={r.id} className="glass rounded-xl p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${r.gradient} flex items-center justify-center shrink-0`}>
                <Icon name={r.prizeIcon as string} size={18} className="text-white" fallback="Gift" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm truncate">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.participants.toLocaleString("ru")} участников</p>
              </div>
              <div className="text-right shrink-0">
                <CountdownTimer endDate={r.endDate} />
              </div>
            </div>
          ))}
        </div>

        <button className="w-full mt-4 py-3 rounded-xl border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 transition-colors text-sm font-medium">
          Пополнить баланс
        </button>
      </div>
    </div>
  );
}
