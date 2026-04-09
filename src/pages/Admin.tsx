import { useState } from "react";
import Icon from "@/components/ui/icon";
import { RAFFLES, HISTORY } from "@/components/raffle-types";

const ADMIN_AUTH_URL = "https://functions.poehali.dev/cc8cbc36-edde-42f3-9196-fbfc8a6e8946";
const SESSION_KEY = "admin_token";

// ─── Login Screen ─────────────────────────────────────────────────────────────

function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(ADMIN_AUTH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      const data = await res.json();
      if (data.ok) {
        sessionStorage.setItem(SESSION_KEY, data.token);
        onSuccess();
      } else {
        setError(data.error || "Ошибка входа");
      }
    } catch {
      setError("Нет соединения с сервером");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center p-4">
      <div className="relative w-full max-w-sm">
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 rounded-3xl blur-lg opacity-40" />
        <div className="relative glass rounded-3xl overflow-hidden border border-white/10">
          <div className="h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400" />
          <div className="p-8">
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl">
                🔐
              </div>
            </div>
            <h1 className="font-oswald text-2xl font-bold text-white text-center mb-1">Панель управления</h1>
            <p className="text-muted-foreground text-sm text-center mb-6">ЮГ ТРАНСФЕР — Администратор</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block font-medium uppercase tracking-wider">Логин</label>
                <div className="relative">
                  <Icon name="User" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    required
                    value={login}
                    onChange={e => setLogin(e.target.value)}
                    placeholder="Введите логин"
                    className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl pl-10 pr-4 py-3 text-white placeholder-muted-foreground text-sm outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block font-medium uppercase tracking-wider">Пароль</label>
                <div className="relative">
                  <Icon name="Lock" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl pl-10 pr-10 py-3 text-white placeholder-muted-foreground text-sm outline-none transition-colors"
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors">
                    <Icon name={showPass ? "EyeOff" : "Eye"} size={16} />
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
                  <Icon name="AlertCircle" size={16} />
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full grad-btn rounded-xl py-3.5 font-bold font-golos flex items-center justify-center gap-2 disabled:opacity-70">
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Вход...</>
                ) : (
                  <><Icon name="LogIn" size={16} />Войти в панель</>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

type AdminTab = "dashboard" | "raffles" | "users" | "history";

function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<AdminTab>("dashboard");

  const TABS = [
    { id: "dashboard" as AdminTab, label: "Обзор", icon: "LayoutDashboard" },
    { id: "raffles" as AdminTab, label: "Розыгрыши", icon: "Gift" },
    { id: "users" as AdminTab, label: "Участники", icon: "Users" },
    { id: "history" as AdminTab, label: "История", icon: "Clock" },
  ];

  const activeRaffles = RAFFLES.filter(r => r.status === "active").length;
  const totalParticipants = RAFFLES.reduce((s, r) => s + r.participants, 0);
  const totalRevenue = HISTORY.reduce((s, h) => s + h.amount, 0);

  return (
    <div className="min-h-screen mesh-bg">
      {/* Header */}
      <header className="glass border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-base">🔐</div>
            <div>
              <span className="font-oswald text-lg font-bold text-white">ЮГ</span>
              <span className="font-oswald text-lg font-bold grad-text"> ТРАНСФЕР</span>
              <span className="text-xs text-muted-foreground ml-2">Админ</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="/" className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1.5">
              <Icon name="ExternalLink" size={14} />
              На сайт
            </a>
            <button onClick={onLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-muted-foreground hover:text-white hover:bg-white/5 transition-all text-sm">
              <Icon name="LogOut" size={15} />
              Выйти
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 flex gap-6">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col gap-1 w-52 shrink-0">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                tab === t.id ? "grad-btn shadow-lg" : "text-muted-foreground hover:text-white hover:bg-white/5"
              }`}>
              <Icon name={t.icon as string} size={17} fallback="Circle" />
              {t.label}
            </button>
          ))}
        </aside>

        {/* Mobile tabs */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/5 flex">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${
                tab === t.id ? "text-purple-400" : "text-muted-foreground"
              }`}>
              <Icon name={t.icon as string} size={18} fallback="Circle" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <main className="flex-1 min-w-0 pb-20 md:pb-0">

          {/* Dashboard */}
          {tab === "dashboard" && (
            <div>
              <h2 className="font-oswald text-3xl font-bold text-white mb-6">Обзор</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  { label: "Активных розыгрышей", value: activeRaffles, icon: "Zap", grad: "from-purple-500 to-pink-500" },
                  { label: "Всего розыгрышей", value: RAFFLES.length, icon: "Gift", grad: "from-cyan-500 to-blue-500" },
                  { label: "Участников", value: totalParticipants.toLocaleString("ru"), icon: "Users", grad: "from-orange-500 to-red-500" },
                  { label: "Выручка", value: totalRevenue.toLocaleString("ru") + " ₽", icon: "Banknote", grad: "from-green-500 to-emerald-500" },
                ].map((s, i) => (
                  <div key={i} className="card-glow rounded-2xl p-5">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.grad} flex items-center justify-center mb-3`}>
                      <Icon name={s.icon as string} size={18} className="text-white" fallback="Star" />
                    </div>
                    <p className="font-oswald text-2xl font-bold text-white">{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="card-glow rounded-2xl p-5">
                <h3 className="font-oswald text-xl font-semibold text-white mb-4">Последние участия</h3>
                <div className="space-y-3">
                  {HISTORY.slice(0, 5).map(h => (
                    <div key={h.id} className="glass rounded-xl px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm font-medium">{h.raffle}</p>
                        <p className="text-xs text-muted-foreground">{h.date}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-bold text-sm">{h.amount.toLocaleString("ru")} ₽</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                          h.status === "Участвую"
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            : "bg-slate-500/20 text-slate-400 border-slate-500/30"
                        }`}>{h.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Raffles */}
          {tab === "raffles" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-oswald text-3xl font-bold text-white">Розыгрыши</h2>
                <button className="grad-btn rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-2">
                  <Icon name="Plus" size={15} />
                  Добавить
                </button>
              </div>
              <div className="space-y-3">
                {RAFFLES.map(r => (
                  <div key={r.id} className="card-glow rounded-2xl p-4 flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${r.gradient} flex items-center justify-center shrink-0`}>
                      <Icon name={r.prizeIcon as string} size={18} className="text-white" fallback="Gift" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{r.prize} · {r.participants.toLocaleString("ru")} участников</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                        r.status === "active" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : r.status === "upcoming" ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
                        : "bg-slate-500/20 text-slate-400 border-slate-500/30"
                      }`}>
                        {r.status === "active" ? "Активен" : r.status === "upcoming" ? "Скоро" : "Завершён"}
                      </span>
                      <button className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-white transition-colors">
                        <Icon name="Pencil" size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Users */}
          {tab === "users" && (
            <div>
              <h2 className="font-oswald text-3xl font-bold text-white mb-6">Участники</h2>
              <div className="card-glow rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/5">
                        {["ID", "Telegram", "Розыгрыш", "Сумма", "Билетов", "Статус"].map(h => (
                          <th key={h} className="px-5 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {HISTORY.map((item, i) => (
                        <tr key={item.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                          <td className="px-5 py-4 text-sm text-muted-foreground">#{item.id}</td>
                          <td className="px-5 py-4 text-sm text-white font-medium">Участник {i + 1}</td>
                          <td className="px-5 py-4 text-sm text-white">{item.raffle}</td>
                          <td className="px-5 py-4 text-sm font-bold text-white">{item.amount.toLocaleString("ru")} ₽</td>
                          <td className="px-5 py-4 text-sm text-muted-foreground">{item.tickets} шт.</td>
                          <td className="px-5 py-4">
                            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                              item.status === "Участвую"
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                : "bg-slate-500/20 text-slate-400 border-slate-500/30"
                            }`}>{item.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* History */}
          {tab === "history" && (
            <div>
              <h2 className="font-oswald text-3xl font-bold text-white mb-6">История</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {[
                  { label: "Всего транзакций", value: HISTORY.length, icon: "List", grad: "from-purple-500 to-pink-500" },
                  { label: "Общая выручка", value: totalRevenue.toLocaleString("ru") + " ₽", icon: "TrendingUp", grad: "from-green-500 to-emerald-500" },
                  { label: "Активных участий", value: HISTORY.filter(h => h.status === "Участвую").length, icon: "Activity", grad: "from-cyan-500 to-blue-500" },
                ].map((s, i) => (
                  <div key={i} className="glass rounded-2xl p-5 flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${s.grad} flex items-center justify-center shrink-0`}>
                      <Icon name={s.icon as string} size={20} className="text-white" fallback="Star" />
                    </div>
                    <div>
                      <p className="font-oswald text-2xl font-bold text-white">{s.value}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="card-glow rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/5">
                        {["Розыгрыш", "Дата", "Сумма", "Билетов", "Статус"].map(h => (
                          <th key={h} className="px-5 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {HISTORY.map(item => (
                        <tr key={item.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                          <td className="px-5 py-4 text-sm text-white font-medium">{item.raffle}</td>
                          <td className="px-5 py-4 text-sm text-muted-foreground">{item.date}</td>
                          <td className="px-5 py-4 text-sm font-bold text-white">{item.amount.toLocaleString("ru")} ₽</td>
                          <td className="px-5 py-4 text-sm text-muted-foreground">{item.tickets} шт.</td>
                          <td className="px-5 py-4">
                            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                              item.status === "Участвую"
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                : "bg-slate-500/20 text-slate-400 border-slate-500/30"
                            }`}>{item.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

// ─── Admin Page (with auth guard) ────────────────────────────────────────────

export default function Admin() {
  const [authed, setAuthed] = useState(() => !!sessionStorage.getItem(SESSION_KEY));

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setAuthed(false);
  };

  if (!authed) return <AdminLogin onSuccess={() => setAuthed(true)} />;
  return <AdminDashboard onLogout={handleLogout} />;
}
