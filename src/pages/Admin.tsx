import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";

const ADMIN_AUTH_URL = "https://functions.poehali.dev/cc8cbc36-edde-42f3-9196-fbfc8a6e8946";
const RAFFLES_URL = "https://functions.poehali.dev/39a7b356-ef83-46dd-81a0-581903229de9";
const SESSION_KEY = "admin_token";

const GRADIENTS = [
  "from-purple-600 via-pink-500 to-orange-400",
  "from-cyan-500 via-blue-500 to-purple-600",
  "from-orange-500 via-red-500 to-pink-600",
  "from-green-500 via-teal-500 to-cyan-500",
  "from-yellow-400 via-orange-400 to-red-500",
  "from-blue-600 via-indigo-600 to-purple-600",
];

const ICONS = ["Gift", "Smartphone", "Plane", "Car", "Headphones", "Banknote", "Gamepad2", "Trophy", "Star", "Zap"];

interface RaffleDB {
  id: number;
  title: string;
  prize: string;
  prize_icon: string;
  end_date: string;
  participants: number;
  min_amount: number;
  status: "active" | "ended" | "upcoming";
  gradient: string;
  winner?: string;
}

const EMPTY_FORM = {
  title: "", prize: "", prize_icon: "Gift", end_date: "",
  participants: 0, min_amount: 100, status: "active" as const,
  gradient: GRADIENTS[0], winner: "",
};

// ─── Login ────────────────────────────────────────────────────────────────────

function AdminLogin({ onSuccess }: { onSuccess: (token: string) => void }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch(ADMIN_AUTH_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      const data = await res.json();
      if (data.ok) { sessionStorage.setItem(SESSION_KEY, data.token); onSuccess(data.token); }
      else setError(data.error || "Ошибка входа");
    } catch { setError("Нет соединения с сервером"); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center p-4">
      <div className="relative w-full max-w-sm">
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 rounded-3xl blur-lg opacity-40" />
        <div className="relative glass rounded-3xl overflow-hidden border border-white/10">
          <div className="h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400" />
          <div className="p-8">
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl">🔐</div>
            </div>
            <h1 className="font-oswald text-2xl font-bold text-white text-center mb-1">Панель управления</h1>
            <p className="text-muted-foreground text-sm text-center mb-6">ЮГ ТРАНСФЕР — Администратор</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block font-medium uppercase tracking-wider">Логин</label>
                <div className="relative">
                  <Icon name="User" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="text" required value={login} onChange={e => setLogin(e.target.value)} placeholder="Введите логин"
                    className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl pl-10 pr-4 py-3 text-white placeholder-muted-foreground text-sm outline-none transition-colors" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block font-medium uppercase tracking-wider">Пароль</label>
                <div className="relative">
                  <Icon name="Lock" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type={showPass ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                    className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl pl-10 pr-10 py-3 text-white placeholder-muted-foreground text-sm outline-none transition-colors" />
                  <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors">
                    <Icon name={showPass ? "EyeOff" : "Eye"} size={16} />
                  </button>
                </div>
              </div>
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
                  <Icon name="AlertCircle" size={16} />{error}
                </div>
              )}
              <button type="submit" disabled={loading} className="w-full grad-btn rounded-xl py-3.5 font-bold font-golos flex items-center justify-center gap-2 disabled:opacity-70">
                {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Вход...</> : <><Icon name="LogIn" size={16} />Войти в панель</>}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Raffle Form Modal ────────────────────────────────────────────────────────

function RaffleFormModal({ initial, token, onSave, onClose }: {
  initial?: RaffleDB; token: string;
  onSave: (r: RaffleDB) => void; onClose: () => void;
}) {
  const [form, setForm] = useState(initial ? {
    title: initial.title, prize: initial.prize, prize_icon: initial.prize_icon,
    end_date: initial.end_date, participants: initial.participants, min_amount: initial.min_amount,
    status: initial.status, gradient: initial.gradient, winner: initial.winner || "",
  } : { ...EMPTY_FORM });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError("");
    try {
      const method = initial ? "PUT" : "POST";
      const body = initial ? { ...form, id: initial.id } : form;
      const res = await fetch(RAFFLES_URL, {
        method, headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) onSave(data.raffle);
      else setError(data.error || "Ошибка");
    } catch { setError("Нет соединения"); }
    finally { setLoading(false); }
  };

  const inputCls = "w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-4 py-2.5 text-white placeholder-muted-foreground text-sm outline-none transition-colors";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in" style={{ animationFillMode: "forwards" }}>
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 rounded-3xl blur-lg opacity-30" />
        <div className="relative glass rounded-3xl border border-white/10">
          <div className="h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400" />
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-oswald text-xl font-bold text-white">{initial ? "Редактировать" : "Новый розыгрыш"}</h3>
              <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-white transition-colors">
                <Icon name="X" size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wider">Название</label>
                <input required value={form.title} onChange={e => set("title", e.target.value)} placeholder="Например: Розыгрыш iPhone" className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wider">Приз</label>
                <input required value={form.prize} onChange={e => set("prize", e.target.value)} placeholder="Например: iPhone 16 Pro Max" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wider">Мин. взнос (₽)</label>
                  <input required type="number" min={1} value={form.min_amount} onChange={e => set("min_amount", Number(e.target.value))} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wider">Дата окончания</label>
                  <input required type="date" value={form.end_date} onChange={e => set("end_date", e.target.value)} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wider">Статус</label>
                <select value={form.status} onChange={e => set("status", e.target.value)} className={inputCls}>
                  <option value="active">Активен</option>
                  <option value="upcoming">Скоро</option>
                  <option value="ended">Завершён</option>
                </select>
              </div>
              {form.status === "ended" && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wider">Победитель</label>
                  <input value={form.winner} onChange={e => set("winner", e.target.value)} placeholder="Имя победителя" className={inputCls} />
                </div>
              )}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wider">Иконка</label>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map(ic => (
                    <button key={ic} type="button" onClick={() => set("prize_icon", ic)}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${form.prize_icon === ic ? "bg-purple-500/40 border border-purple-500/60" : "bg-white/5 border border-white/10 hover:bg-white/10"}`}>
                      <Icon name={ic as string} size={16} className="text-white" fallback="Gift" />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wider">Цвет карточки</label>
                <div className="flex flex-wrap gap-2">
                  {GRADIENTS.map(g => (
                    <button key={g} type="button" onClick={() => set("gradient", g)}
                      className={`w-8 h-8 rounded-xl bg-gradient-to-br ${g} transition-all ${form.gradient === g ? "ring-2 ring-white/60 scale-110" : "opacity-70 hover:opacity-100"}`} />
                  ))}
                </div>
              </div>
              {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-white/10 text-muted-foreground hover:text-white hover:bg-white/5 transition-all text-sm font-medium">Отмена</button>
                <button type="submit" disabled={loading} className="flex-1 grad-btn rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-70">
                  {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Icon name={initial ? "Save" : "Plus"} size={15} />}
                  {initial ? "Сохранить" : "Создать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

type AdminTab = "dashboard" | "raffles";

function AdminDashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [tab, setTab] = useState<AdminTab>("raffles");
  const [raffles, setRaffles] = useState<RaffleDB[]>([]);
  const [loadingRaffles, setLoadingRaffles] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RaffleDB | undefined>();
  const [deleting, setDeleting] = useState<number | null>(null);

  const fetchRaffles = async () => {
    setLoadingRaffles(true);
    try {
      const res = await fetch(RAFFLES_URL);
      const data = await res.json();
      if (data.ok) setRaffles(data.raffles);
    } finally { setLoadingRaffles(false); }
  };

  useEffect(() => { fetchRaffles(); }, []);

  const handleSave = (r: RaffleDB) => {
    setRaffles(prev => {
      const idx = prev.findIndex(x => x.id === r.id);
      return idx >= 0 ? prev.map(x => x.id === r.id ? r : x) : [r, ...prev];
    });
    setFormOpen(false); setEditTarget(undefined);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Удалить розыгрыш?")) return;
    setDeleting(id);
    try {
      await fetch(RAFFLES_URL, {
        method: "DELETE", headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify({ id }),
      });
      setRaffles(prev => prev.filter(r => r.id !== id));
    } finally { setDeleting(null); }
  };

  const active = raffles.filter(r => r.status === "active").length;
  const participants = raffles.reduce((s, r) => s + r.participants, 0);

  const TABS = [
    { id: "dashboard" as AdminTab, label: "Обзор", icon: "LayoutDashboard" },
    { id: "raffles" as AdminTab, label: "Розыгрыши", icon: "Gift" },
  ];

  const statusLabel: Record<string, string> = { active: "Активен", upcoming: "Скоро", ended: "Завершён" };
  const statusCls: Record<string, string> = {
    active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    upcoming: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    ended: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  };

  return (
    <div className="min-h-screen mesh-bg">
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
              <Icon name="ExternalLink" size={14} />На сайт
            </a>
            <button onClick={onLogout} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-muted-foreground hover:text-white hover:bg-white/5 transition-all text-sm">
              <Icon name="LogOut" size={15} />Выйти
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 flex gap-6">
        <aside className="hidden md:flex flex-col gap-1 w-52 shrink-0">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${tab === t.id ? "grad-btn shadow-lg" : "text-muted-foreground hover:text-white hover:bg-white/5"}`}>
              <Icon name={t.icon as string} size={17} fallback="Circle" />{t.label}
            </button>
          ))}
        </aside>

        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/5 flex">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${tab === t.id ? "text-purple-400" : "text-muted-foreground"}`}>
              <Icon name={t.icon as string} size={18} fallback="Circle" />{t.label}
            </button>
          ))}
        </div>

        <main className="flex-1 min-w-0 pb-20 md:pb-0">

          {tab === "dashboard" && (
            <div>
              <h2 className="font-oswald text-3xl font-bold text-white mb-6">Обзор</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: "Активных", value: active, icon: "Zap", grad: "from-purple-500 to-pink-500" },
                  { label: "Всего розыгрышей", value: raffles.length, icon: "Gift", grad: "from-cyan-500 to-blue-500" },
                  { label: "Участников", value: participants.toLocaleString("ru"), icon: "Users", grad: "from-orange-500 to-red-500" },
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
            </div>
          )}

          {tab === "raffles" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-oswald text-3xl font-bold text-white">Розыгрыши</h2>
                <button onClick={() => { setEditTarget(undefined); setFormOpen(true); }}
                  className="grad-btn rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-2">
                  <Icon name="Plus" size={15} />Добавить
                </button>
              </div>

              {loadingRaffles ? (
                <div className="flex justify-center py-20 text-muted-foreground">
                  <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                </div>
              ) : raffles.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                  <Icon name="Gift" size={48} className="mx-auto mb-3 opacity-20" />
                  <p className="mb-4">Розыгрышей пока нет</p>
                  <button onClick={() => { setEditTarget(undefined); setFormOpen(true); }}
                    className="grad-btn rounded-xl px-6 py-2.5 text-sm font-semibold">
                    Создать первый
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {raffles.map(r => (
                    <div key={r.id} className="card-glow rounded-2xl p-4 flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${r.gradient} flex items-center justify-center shrink-0`}>
                        <Icon name={r.prize_icon as string} size={18} className="text-white" fallback="Gift" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate">{r.title}</p>
                        <p className="text-xs text-muted-foreground">{r.prize} · до {r.end_date} · {r.min_amount} ₽</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${statusCls[r.status]}`}>
                          {statusLabel[r.status]}
                        </span>
                        <button onClick={() => { setEditTarget(r); setFormOpen(true); }}
                          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-white transition-colors">
                          <Icon name="Pencil" size={14} />
                        </button>
                        <button onClick={() => handleDelete(r.id)} disabled={deleting === r.id}
                          className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center text-red-400 transition-colors disabled:opacity-40">
                          {deleting === r.id
                            ? <div className="w-3 h-3 border border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                            : <Icon name="Trash2" size={14} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </main>
      </div>

      {formOpen && (
        <RaffleFormModal
          initial={editTarget}
          token={token}
          onSave={handleSave}
          onClose={() => { setFormOpen(false); setEditTarget(undefined); }}
        />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Admin() {
  const [token, setToken] = useState(() => sessionStorage.getItem(SESSION_KEY) || "");

  const handleLogout = () => { sessionStorage.removeItem(SESSION_KEY); setToken(""); };

  if (!token) return <AdminLogin onSuccess={t => setToken(t)} />;
  return <AdminDashboard token={token} onLogout={handleLogout} />;
}
