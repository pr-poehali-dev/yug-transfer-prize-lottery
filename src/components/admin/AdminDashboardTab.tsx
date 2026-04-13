import Icon from "@/components/ui/icon";
import { AdminStats, RaffleDB } from "./adminTypes";

interface AdminDashboardTabProps {
  stats: AdminStats | null;
  loadingStats: boolean;
  raffles: RaffleDB[];
}

export function AdminDashboardTab({ stats, loadingStats, raffles }: AdminDashboardTabProps) {
  const active = raffles.filter(r => r.status === "active").length;
  const ended = raffles.filter(r => r.status === "ended");

  return (
    <div>
      <h2 className="font-oswald text-3xl font-bold text-white mb-6">Обзор</h2>
      {loadingStats ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Всего клиентов", value: stats?.users.total ?? raffles.length, sub: `+${stats?.users.new_week ?? 0} за неделю`, icon: "Users", grad: "from-purple-500 to-pink-500" },
              { label: "Платежей", value: stats?.payments.total_count ?? 0, sub: `${(stats?.payments.month_amount ?? 0).toLocaleString("ru")} ₽ за месяц`, icon: "CreditCard", grad: "from-cyan-500 to-blue-500" },
              { label: "Оборот всего", value: `${(stats?.payments.total_amount ?? 0).toLocaleString("ru")} ₽`, sub: "все платежи", icon: "Banknote", grad: "from-orange-500 to-red-500" },
              { label: "Активных розыгрышей", value: stats?.raffles.active ?? active, sub: `всего ${stats?.raffles.total ?? raffles.length}`, icon: "Gift", grad: "from-green-500 to-teal-500" },
            ].map((s, i) => (
              <div key={i} className="card-glow rounded-2xl p-5">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.grad} flex items-center justify-center mb-3`}>
                  <Icon name={s.icon as string} size={18} className="text-white" fallback="Star" />
                </div>
                <p className="font-oswald text-2xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                <p className="text-xs text-purple-400 mt-1">{s.sub}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="card-glow rounded-2xl p-5">
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2"><Icon name="TrendingUp" size={16} className="text-purple-400" />Новые клиенты</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">За 7 дней</span><span className="text-white font-medium">{stats?.users.new_week ?? 0}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">За 30 дней</span><span className="text-white font-medium">{stats?.users.new_month ?? 0}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Всего</span><span className="text-white font-medium">{stats?.users.total ?? 0}</span></div>
              </div>
            </div>
            <div className="card-glow rounded-2xl p-5">
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2"><Icon name="Wallet" size={16} className="text-cyan-400" />Финансы</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Платежей за месяц</span><span className="text-white font-medium">{(stats?.payments.month_amount ?? 0).toLocaleString("ru")} ₽</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Кол-во транзакций</span><span className="text-white font-medium">{stats?.payments.total_count ?? 0}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Участий в розыгрышах</span><span className="text-white font-medium">{stats?.entries.total ?? 0}</span></div>
              </div>
            </div>
          </div>

          {ended.length > 0 && (
            <div>
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                <Icon name="Trophy" size={16} className="text-yellow-400" />Завершённые розыгрыши
              </h3>
              <div className="space-y-3">
                {ended.map(r => {
                  const rs = stats?.raffle_stats?.[String(r.id)];
                  return (
                    <div key={r.id} className="card-glow rounded-2xl p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl shrink-0 overflow-hidden bg-white/5 flex items-center justify-center">
                          {r.photo_url
                            ? <img src={r.photo_url} alt={r.title} className="w-full h-full object-cover" />
                            : <div className={`w-full h-full bg-gradient-to-br ${r.gradient} flex items-center justify-center`}>
                                <Icon name={r.prize_icon as string} size={18} className="text-white" fallback="Gift" />
                              </div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold text-sm truncate">{r.title}</p>
                          {r.winner && <p className="text-xs text-yellow-400">🏆 {r.winner}</p>}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white/5 rounded-xl px-3 py-2 text-center">
                          <p className="text-lg font-bold text-white">{rs?.participants ?? 0}</p>
                          <p className="text-[10px] text-muted-foreground">Участников</p>
                        </div>
                        <div className="bg-white/5 rounded-xl px-3 py-2 text-center">
                          <p className="text-lg font-bold text-white">{rs?.entries ?? 0}</p>
                          <p className="text-[10px] text-muted-foreground">Билетов</p>
                        </div>
                        <div className="bg-white/5 rounded-xl px-3 py-2 text-center">
                          <p className="text-lg font-bold text-white">{(rs?.total_amount ?? 0).toLocaleString("ru")} ₽</p>
                          <p className="text-[10px] text-muted-foreground">Собрано</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}