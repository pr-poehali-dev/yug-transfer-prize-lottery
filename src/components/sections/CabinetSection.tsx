import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import type { AppUser } from "@/pages/Index";

const CABINET_URL = "https://functions.poehali.dev/0ad2d0a9-bb39-4116-9934-9460e7841500";
const PAYMENT_URL = "https://functions.poehali.dev/81f8c74e-7d9c-47ff-8dfc-8f0e3dd7a155";

interface Entry {
  id: number;
  raffle_title: string;
  raffle_prize: string;
  raffle_icon: string;
  raffle_gradient: string;
  raffle_status: string;
  winner: string | null;
  tickets: number;
  amount: number;
  created_at: string;
}

interface DepositModalProps {
  userId: number;
  onClose: () => void;
  onSuccess: (amount: number) => void;
}

function DepositModal({ onClose }: DepositModalProps) {
  const PRESETS = [100, 500, 1000, 3000, 5000];
  const [amount, setAmount] = useState(500);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm">
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 rounded-3xl blur-lg opacity-40" />
        <div className="relative glass rounded-3xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-oswald text-xl font-bold text-white">Пополнить баланс</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-full glass flex items-center justify-center text-muted-foreground hover:text-white transition-colors">
              <Icon name="X" size={16} />
            </button>
          </div>

          <p className="text-sm text-muted-foreground mb-4">Выбери сумму или введи свою:</p>

          <div className="flex flex-wrap gap-2 mb-4">
            {PRESETS.map(p => (
              <button key={p} onClick={() => setAmount(p)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${amount === p ? "grad-btn" : "glass text-white hover:bg-white/10"}`}>
                {p.toLocaleString("ru")} ₽
              </button>
            ))}
          </div>

          <div className="relative mb-4">
            <input
              type="number" min={100} step={50}
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              className="w-full glass rounded-xl px-4 py-3 text-white text-right text-lg font-bold pr-10 outline-none focus:ring-1 focus:ring-purple-500"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₽</span>
          </div>

          <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/30 p-4 text-center">
            <div className="text-2xl mb-2">🔧</div>
            <p className="text-yellow-300 font-semibold text-sm mb-1">Оплата скоро будет доступна</p>
            <p className="text-muted-foreground text-xs">Подключаем ЮKassa — совсем скоро сможешь пополнять баланс онлайн</p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CabinetSectionProps {
  user: AppUser | null;
  onLogin: () => void;
  onLogout: () => void;
  onUserUpdate: (user: AppUser) => void;
}

export function CabinetSection({ user, onLogin, onLogout, onUserUpdate }: CabinetSectionProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [tab, setTab] = useState<"active" | "all">("active");

  useEffect(() => {
    if (!user) return;
    setLoadingEntries(true);
    fetch(`${CABINET_URL}?entries`, { headers: { "X-User-Id": String(user.id) } })
      .then(r => r.json())
      .then(d => { if (d.ok) setEntries(d.entries); })
      .catch(() => {})
      .finally(() => setLoadingEntries(false));
  }, [user?.id]);

  // Обновляем профиль при возврате со страницы оплаты
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
      <div className="max-w-3xl mx-auto text-center py-20">
        <div className="text-6xl mb-6 animate-float inline-block">🔐</div>
        <h2 className="font-oswald text-3xl font-bold text-white mb-3">Войди в кабинет</h2>
        <p className="text-muted-foreground mb-8">Чтобы видеть свой баланс и участия — войди через Telegram</p>
        <button onClick={onLogin} className="grad-btn rounded-2xl px-10 py-4 font-bold text-base flex items-center gap-2 mx-auto">
          <Icon name="LogIn" size={20} />
          Войти через Telegram
        </button>
      </div>
    );
  }

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");
  const activeEntries = entries.filter(e => e.raffle_status === "active");
  const shownEntries = tab === "active" ? activeEntries : entries;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Профиль */}
      <div className="glass rounded-3xl p-6 mb-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-cyan-500/10 pointer-events-none" />
        <div className="flex items-center gap-5 relative">
          <div className="relative shrink-0">
            {user.photo_url ? (
              <img src={user.photo_url} alt={fullName} className="w-20 h-20 rounded-2xl object-cover border-2 border-purple-500/40" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl animate-float">
                {user.first_name[0]?.toUpperCase() || "?"}
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full border-2 border-background" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-oswald text-2xl font-bold text-white truncate">{fullName}</h2>
            {user.username && <p className="text-muted-foreground text-sm mb-2">@{user.username}</p>}
            <span className="text-xs px-3 py-1 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border border-purple-500/30 font-medium">
              Участник
            </span>
          </div>
          <div className="ml-auto text-right hidden md:block shrink-0">
            <p className="text-muted-foreground text-xs mb-1">Баланс</p>
            <p className="font-oswald text-3xl font-bold grad-text">{user.balance.toLocaleString("ru")} ₽</p>
          </div>
        </div>
        {/* Баланс на мобиле */}
        <div className="md:hidden mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Баланс</p>
            <p className="font-oswald text-2xl font-bold grad-text">{user.balance.toLocaleString("ru")} ₽</p>
          </div>
          <button onClick={() => setShowDeposit(true)} className="grad-btn rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-1.5">
            <Icon name="Plus" size={16} /> Пополнить
          </button>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Участий", value: user.total_entries, icon: "Ticket", color: "from-purple-500 to-pink-500" },
          { label: "Побед", value: user.wins, icon: "Trophy", color: "from-yellow-500 to-orange-500" },
          { label: "Потрачено", value: `${user.total_spent.toLocaleString("ru")} ₽`, icon: "CreditCard", color: "from-cyan-500 to-blue-500" },
          { label: "Баланс", value: `${user.balance.toLocaleString("ru")} ₽`, icon: "Wallet", color: "from-green-500 to-emerald-500" },
        ].map((s, i) => (
          <div key={s.label} className="card-glow rounded-2xl p-4 text-center opacity-0-init animate-fade-in-up"
            style={{ animationDelay: `${i * 0.1}s`, animationFillMode: "forwards" }}>
            <div className={`w-10 h-10 mx-auto mb-3 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center`}>
              <Icon name={s.icon} size={18} className="text-white" fallback="Star" />
            </div>
            <p className="font-oswald text-xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Участия */}
      <div className="card-glow rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-oswald text-xl font-semibold text-white flex items-center gap-2">
            <Icon name="Zap" size={20} className="text-yellow-400" />
            Мои участия
          </h3>
          <div className="flex gap-1">
            {(["active", "all"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${tab === t ? "bg-purple-500/30 text-purple-300" : "text-muted-foreground hover:text-white"}`}>
                {t === "active" ? "Активные" : "Все"}
              </button>
            ))}
          </div>
        </div>

        {loadingEntries ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-2" />
            Загружаем участия...
          </div>
        ) : shownEntries.length === 0 ? (
          <div className="py-8 text-center">
            <div className="text-4xl mb-3">🎟️</div>
            <p className="text-muted-foreground text-sm">
              {tab === "active" ? "Нет активных участий" : "Ты ещё не участвовал ни в одном розыгрыше"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {shownEntries.map(e => (
              <div key={e.id} className="glass rounded-xl p-4 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${e.raffle_gradient} flex items-center justify-center shrink-0`}>
                  <Icon name={e.raffle_icon} size={18} className="text-white" fallback="Gift" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{e.raffle_title}</p>
                  <p className="text-xs text-muted-foreground">{e.tickets} билет · {e.amount.toLocaleString("ru")} ₽</p>
                </div>
                <div className="text-right shrink-0">
                  {e.raffle_status === "ended" ? (
                    <span className={`text-xs px-2 py-1 rounded-full ${e.winner ? "bg-yellow-500/20 text-yellow-300" : "bg-white/10 text-muted-foreground"}`}>
                      {e.winner ? "🏆 Завершён" : "Завершён"}
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400">Активен</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <button onClick={() => setShowDeposit(true)}
            className="flex-1 py-3 rounded-xl grad-btn font-semibold text-sm flex items-center justify-center gap-2">
            <Icon name="Plus" size={16} /> Пополнить баланс
          </button>
          <button onClick={onLogout}
            className="px-4 py-3 rounded-xl border border-white/10 text-muted-foreground hover:text-white hover:border-white/30 transition-all text-sm">
            <Icon name="LogOut" size={16} />
          </button>
        </div>
      </div>

      {showDeposit && (
        <DepositModal
          userId={user.id}
          onClose={() => setShowDeposit(false)}
          onSuccess={(amount) => {
            onUserUpdate({ ...user, balance: user.balance + amount });
            setShowDeposit(false);
          }}
        />
      )}
    </div>
  );
}