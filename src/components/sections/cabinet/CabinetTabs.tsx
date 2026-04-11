import Icon from "@/components/ui/icon";
import { Entry, Transaction, formatDate } from "./cabinet-types";

interface CabinetTabsProps {
  tab: "entries" | "transactions" | "wins";
  setTab: (t: "entries" | "transactions" | "wins") => void;
  entries: Entry[];
  transactions: Transaction[];
  myWins: Entry[];
  loading: boolean;
}

export function CabinetTabs({ tab, setTab, entries, transactions, myWins, loading }: CabinetTabsProps) {
  const TABS = [
    { key: "entries" as const, label: "Участия", icon: "Ticket", count: entries.length },
    { key: "transactions" as const, label: "Транзакции", icon: "CreditCard", count: transactions.length },
    { key: "wins" as const, label: "Выигрыши", icon: "Trophy", count: myWins.length },
  ];

  return (
    <>
      {/* Табы */}
      <div className="glass rounded-2xl p-1.5 flex gap-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === t.key ? "grad-btn" : "text-muted-foreground hover:text-white"}`}>
            <Icon name={t.icon as "Ticket"} size={15} />
            <span className="hidden sm:inline">{t.label}</span>
            {t.count > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? "bg-white/20" : "bg-white/10"}`}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Контент */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {tab === "entries" && (
            <div className="space-y-3">
              {entries.length === 0 ? (
                <div className="glass rounded-2xl p-10 text-center">
                  <div className="text-5xl mb-3">🎫</div>
                  <p className="text-muted-foreground">Ты ещё не участвовал в розыгрышах</p>
                </div>
              ) : entries.map(e => (
                <div key={e.id} className="glass rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl shrink-0 overflow-hidden bg-white/5 flex items-center justify-center">
                    {e.raffle_photo
                      ? <img src={e.raffle_photo} alt={e.raffle_title} className="w-full h-full object-cover" />
                      : <span className="text-3xl">{e.raffle_icon || "🎁"}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm truncate">{e.raffle_title}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">{e.raffle_prize}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">{formatDate(e.created_at)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-oswald text-lg font-bold text-white">{e.amount.toLocaleString("ru")} ₽</p>
                    <p className="text-xs text-muted-foreground">{e.tickets} билет{e.tickets === 1 ? "" : e.tickets < 5 ? "а" : "ов"}</p>
                    <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${e.raffle_status === "active" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-white/5 text-muted-foreground border border-white/10"}`}>
                      {e.raffle_status === "active" ? "Активен" : "Завершён"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "transactions" && (
            <div className="space-y-3">
              {transactions.length === 0 ? (
                <div className="glass rounded-2xl p-10 text-center">
                  <div className="text-5xl mb-3">💳</div>
                  <p className="text-muted-foreground">Транзакций пока нет</p>
                </div>
              ) : transactions.map(t => (
                <div key={t.id} className="glass rounded-2xl p-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${t.amount > 0 ? "bg-emerald-500/20" : "bg-red-500/20"}`}>
                    <Icon name={t.amount > 0 ? "ArrowDownLeft" : "ArrowUpRight"} size={18} className={t.amount > 0 ? "text-emerald-400" : "text-red-400"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm">{t.description || (t.type === "deposit" ? "Пополнение" : "Списание")}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">{formatDate(t.created_at)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-oswald text-xl font-bold ${t.amount > 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {t.amount > 0 ? "+" : ""}{t.amount.toLocaleString("ru")} ₽
                    </p>
                    <span className={`text-xs ${t.status === "completed" ? "text-emerald-400/70" : "text-yellow-400/70"}`}>
                      {t.status === "completed" ? "Выполнено" : "В обработке"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "wins" && (
            <div className="space-y-3">
              {myWins.length === 0 ? (
                <div className="glass rounded-2xl p-10 text-center">
                  <div className="text-5xl mb-3">🏆</div>
                  <p className="text-white font-semibold mb-1">Выигрышей пока нет</p>
                  <p className="text-muted-foreground text-sm">Участвуй в розыгрышах — удача на твоей стороне!</p>
                </div>
              ) : myWins.map(e => (
                <div key={e.id} className="glass rounded-2xl p-4 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 via-transparent to-orange-500/10 pointer-events-none" />
                  <div className="flex items-center gap-4 relative">
                    <div className="w-16 h-16 rounded-xl shrink-0 overflow-hidden bg-white/5 flex items-center justify-center">
                      {e.raffle_photo
                        ? <img src={e.raffle_photo} alt={e.raffle_title} className="w-full h-full object-cover" />
                        : <span className="text-4xl">{e.raffle_icon || "🏆"}</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white">{e.raffle_title}</p>
                      <p className="text-yellow-400 text-sm font-medium mt-0.5">🎁 {e.raffle_prize}</p>
                      <p className="text-muted-foreground text-xs mt-1">{formatDate(e.created_at)}</p>
                    </div>
                    <div className="shrink-0">
                      <span className="text-xs px-3 py-1.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-bold">
                        ПОБЕДА
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}