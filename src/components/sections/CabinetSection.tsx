import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import type { AppUser } from "@/pages/Index";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const CABINET_URL = "https://functions.poehali.dev/0ad2d0a9-bb39-4116-9934-9460e7841500";

interface Entry {
  id: number;
  raffle_title: string;
  raffle_prize: string;
  raffle_icon: string;
  raffle_status: string;
  winner: string | null;
  tickets: number;
  amount: number;
  created_at: string;
}

interface Transaction {
  id: number;
  type: string;
  amount: number;
  description: string;
  status: string;
  created_at: string;
}

interface CabinetSectionProps {
  user: AppUser | null;
  onLogin: () => void;
  onLogout: () => void;
  onUserUpdate: (user: AppUser) => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

function Avatar({ user, size = 80 }: { user: AppUser; size?: number }) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");
  if (user.photo_url) {
    return <img src={user.photo_url} alt={fullName} className="rounded-2xl object-cover border-2 border-purple-500/40" style={{ width: size, height: size }} />;
  }
  return (
    <div className="rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {user.first_name[0]?.toUpperCase() || "?"}
    </div>
  );
}

export function CabinetSection({ user, onLogin, onLogout, onUserUpdate }: CabinetSectionProps) {
  const [tab, setTab] = useState<"entries" | "transactions" | "wins">("entries");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const { status: pushStatus, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe, isSupported: pushSupported } = usePushNotifications(user?.id);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      fetch(`${CABINET_URL}?entries`, { headers: { "X-User-Id": String(user.id) } }).then(r => r.json()),
      fetch(`${CABINET_URL}?transactions`, { headers: { "X-User-Id": String(user.id) } }).then(r => r.json()),
    ]).then(([e, t]) => {
      if (e.ok) setEntries(e.entries || []);
      if (t.ok) setTransactions(t.transactions || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      fetch(CABINET_URL, { headers: { "X-User-Id": String(user.id) } })
        .then(r => r.json())
        .then(d => { if (d.ok) onUserUpdate(d.user as AppUser); });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto text-center py-24">
        <div className="text-7xl mb-6 animate-float inline-block">🔐</div>
        <h2 className="font-oswald text-3xl font-bold text-white mb-3">Личный кабинет</h2>
        <p className="text-muted-foreground mb-8 text-base">Войди через Telegram — это быстро и безопасно</p>
        <button onClick={onLogin} className="grad-btn rounded-2xl px-10 py-4 font-bold text-base flex items-center gap-2 mx-auto">
          <Icon name="LogIn" size={20} />
          Войти через Telegram
        </button>
      </div>
    );
  }

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");
  const wins = entries.filter(e => e.raffle_status === "ended" && e.winner);
  const myWins = wins.filter(e => e.winner === user.username || e.winner === fullName);
  const activeEntries = entries.filter(e => e.raffle_status === "active");

  const TABS = [
    { key: "entries", label: "Участия", icon: "Ticket", count: entries.length },
    { key: "transactions", label: "Транзакции", icon: "CreditCard", count: transactions.length },
    { key: "wins", label: "Выигрыши", icon: "Trophy", count: myWins.length },
  ] as const;

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* Профиль */}
      <div className="glass rounded-3xl p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-cyan-500/10 pointer-events-none" />
        <div className="flex items-center gap-4 relative">
          <div className="relative shrink-0">
            <Avatar user={user} size={76} />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full border-2 border-background" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-oswald text-2xl font-bold text-white truncate">{fullName}</h2>
            {user.username && <p className="text-muted-foreground text-sm">@{user.username}</p>}
            <span className="inline-block mt-1.5 text-xs px-3 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium">
              Участник
            </span>
          </div>
          <button onClick={onLogout} className="shrink-0 p-2.5 rounded-xl glass text-muted-foreground hover:text-red-400 transition-colors" title="Выйти">
            <Icon name="LogOut" size={18} />
          </button>
        </div>

        {/* Баланс + пополнение */}
        <div className="mt-5 pt-5 border-t border-white/10 flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Баланс</p>
            <p className="font-oswald text-3xl font-bold grad-text">{user.balance.toLocaleString("ru")} ₽</p>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-1.5">
              <Icon name="Clock" size={13} />
              Пополнение скоро
            </div>
            {pushSupported && (
              <button
                onClick={pushStatus === "subscribed" ? pushUnsubscribe : pushSubscribe}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition-all ${pushStatus === "subscribed" ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10" : "border-white/10 text-muted-foreground glass hover:text-white"}`}
              >
                <Icon name={pushStatus === "subscribed" ? "Bell" : "BellOff"} size={13} />
                {pushStatus === "subscribed" ? "Уведомления вкл" : "Включить уведомления"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Участий", value: user.total_entries, icon: "Ticket", from: "from-purple-500", to: "to-pink-500" },
          { label: "Выигрышей", value: myWins.length, icon: "Trophy", from: "from-yellow-500", to: "to-orange-500" },
          { label: "Потрачено", value: `${user.total_spent.toLocaleString("ru")} ₽`, icon: "CreditCard", from: "from-cyan-500", to: "to-blue-500" },
          { label: "Активных", value: activeEntries.length, icon: "Zap", from: "from-green-500", to: "to-emerald-500" },
        ].map((s, i) => (
          <div key={s.label} className="glass rounded-2xl p-4 text-center opacity-0 animate-fade-in-up"
            style={{ animationDelay: `${i * 0.08}s`, animationFillMode: "forwards" }}>
            <div className={`w-10 h-10 mx-auto mb-2.5 rounded-xl bg-gradient-to-br ${s.from} ${s.to} flex items-center justify-center`}>
              <Icon name={s.icon as "Ticket"} size={18} className="text-white" />
            </div>
            <p className="font-oswald text-xl font-bold text-white">{s.value}</p>
            <p className="text-muted-foreground text-xs mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

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

      {/* Контент табов */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Участия */}
          {tab === "entries" && (
            <div className="space-y-3">
              {entries.length === 0 ? (
                <div className="glass rounded-2xl p-10 text-center">
                  <div className="text-5xl mb-3">🎫</div>
                  <p className="text-muted-foreground">Ты ещё не участвовал в розыгрышах</p>
                </div>
              ) : entries.map(e => (
                <div key={e.id} className="glass rounded-2xl p-4 flex items-center gap-4">
                  <div className="text-3xl shrink-0">{e.raffle_icon || "🎁"}</div>
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

          {/* Транзакции */}
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

          {/* Выигрыши */}
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
                    <div className="text-4xl shrink-0">{e.raffle_icon || "🏆"}</div>
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
    </div>
  );
}
