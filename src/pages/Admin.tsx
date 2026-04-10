import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";

const ADMIN_AUTH_URL = "https://functions.poehali.dev/cc8cbc36-edde-42f3-9196-fbfc8a6e8946";
const RAFFLES_URL = "https://functions.poehali.dev/39a7b356-ef83-46dd-81a0-581903229de9";
const ADMIN_STATS_URL = "https://functions.poehali.dev/fa4cc22e-4f17-475f-ab1a-eb15d4c5971b";
const ADMIN_CLIENTS_URL = "https://functions.poehali.dev/68991b02-f3e2-4903-8cd2-2239bf9116ac";
const ADMIN_NOTIFY_URL = "https://functions.poehali.dev/b8105351-4e67-40ce-a46c-7a2e2d9ccad0";
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

type AdminTab = "dashboard" | "raffles" | "clients" | "notify";

interface AdminStats {
  users: { total: number; new_week: number; new_month: number };
  payments: { total_amount: number; total_count: number; month_amount: number };
  entries: { total: number };
  raffles: { active: number; total: number };
}

interface Client {
  id: number;
  telegram_id: number;
  first_name: string;
  last_name: string;
  username: string;
  photo_url: string;
  balance: number;
  created_at: string;
  total_paid: number;
  payments_count: number;
  entries_count: number;
}

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  sent_at: string;
  recipients_count: number;
}

function AdminDashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [tab, setTab] = useState<AdminTab>("raffles");
  const [raffles, setRaffles] = useState<RaffleDB[]>([]);
  const [loadingRaffles, setLoadingRaffles] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RaffleDB | undefined>();
  const [deleting, setDeleting] = useState<number | null>(null);

  // Stats
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Clients
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsTotal, setClientsTotal] = useState(0);
  const [clientsPage, setClientsPage] = useState(1);
  const [clientsPages, setClientsPages] = useState(1);
  const [clientsSearch, setClientsSearch] = useState("");
  const [loadingClients, setLoadingClients] = useState(false);

  // Notify
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyMsg, setNotifyMsg] = useState("");
  const [notifyType, setNotifyType] = useState("info");
  const [sendingNotify, setSendingNotify] = useState(false);
  const [notifyResult, setNotifyResult] = useState<{ sent: number; total: number } | null>(null);
  const [notifyHistory, setNotifyHistory] = useState<Notification[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchRaffles = async () => {
    setLoadingRaffles(true);
    try {
      const res = await fetch(RAFFLES_URL);
      const data = await res.json();
      if (data.ok) setRaffles(data.raffles);
    } finally { setLoadingRaffles(false); }
  };

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch(ADMIN_STATS_URL, { headers: { 'X-Admin-Token': token } });
      const data = await res.json();
      if (data.ok) setStats(data);
    } finally { setLoadingStats(false); }
  };

  const fetchClients = async (page = 1, search = "") => {
    setLoadingClients(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (search) params.set("search", search);
      const res = await fetch(`${ADMIN_CLIENTS_URL}?${params}`, { headers: { 'X-Admin-Token': token } });
      const data = await res.json();
      if (data.ok) {
        setClients(data.clients);
        setClientsTotal(data.total);
        setClientsPages(data.pages);
        setClientsPage(page);
      }
    } finally { setLoadingClients(false); }
  };

  const fetchNotifyHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(ADMIN_NOTIFY_URL, { headers: { 'X-Admin-Token': token } });
      const data = await res.json();
      if (data.ok) setNotifyHistory(data.history);
    } finally { setLoadingHistory(false); }
  };

  const handleSendNotify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifyTitle.trim() || !notifyMsg.trim()) return;
    setSendingNotify(true); setNotifyResult(null);
    try {
      const res = await fetch(ADMIN_NOTIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify({ title: notifyTitle, message: notifyMsg, type: notifyType }),
      });
      const data = await res.json();
      if (data.ok) {
        setNotifyResult({ sent: data.sent, total: data.total });
        setNotifyTitle(""); setNotifyMsg("");
        fetchNotifyHistory();
      }
    } finally { setSendingNotify(false); }
  };

  useEffect(() => { fetchRaffles(); }, []);
  useEffect(() => { if (tab === "dashboard") fetchStats(); }, [tab]);
  useEffect(() => { if (tab === "clients") fetchClients(1, clientsSearch); }, [tab]);
  useEffect(() => { if (tab === "notify") fetchNotifyHistory(); }, [tab]);

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
    { id: "clients" as AdminTab, label: "Клиенты", icon: "Users" },
    { id: "notify" as AdminTab, label: "Рассылка", icon: "Bell" },
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </>
              )}
            </div>
          )}

          {tab === "clients" && (
            <div>
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <h2 className="font-oswald text-3xl font-bold text-white">Клиенты <span className="text-muted-foreground text-xl">({clientsTotal})</span></h2>
                <div className="relative">
                  <Icon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={clientsSearch}
                    onChange={e => { setClientsSearch(e.target.value); fetchClients(1, e.target.value); }}
                    placeholder="Поиск по имени, @username..."
                    className="bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl pl-9 pr-4 py-2 text-white placeholder-muted-foreground text-sm outline-none w-64"
                  />
                </div>
              </div>
              {loadingClients ? (
                <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" /></div>
              ) : clients.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                  <Icon name="Users" size={48} className="mx-auto mb-3 opacity-20" />
                  <p>Клиентов пока нет</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2 mb-4">
                    {clients.map(c => (
                      <div key={c.id} className="card-glow rounded-2xl p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden">
                          {c.photo_url ? <img src={c.photo_url} alt="" className="w-full h-full object-cover" /> : (c.first_name[0] || "?").toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium text-sm">{c.first_name} {c.last_name}</p>
                          <p className="text-xs text-muted-foreground">{c.username ? `@${c.username}` : `TG: ${c.telegram_id}`} · {c.created_at.slice(0, 10)}</p>
                        </div>
                        <div className="hidden md:flex items-center gap-4 text-xs shrink-0">
                          <div className="text-center">
                            <p className="text-white font-semibold">{c.total_paid.toLocaleString("ru")} ₽</p>
                            <p className="text-muted-foreground">оплачено</p>
                          </div>
                          <div className="text-center">
                            <p className="text-white font-semibold">{c.payments_count}</p>
                            <p className="text-muted-foreground">платежей</p>
                          </div>
                          <div className="text-center">
                            <p className="text-white font-semibold">{c.entries_count}</p>
                            <p className="text-muted-foreground">участий</p>
                          </div>
                          <div className="text-center">
                            <p className="text-white font-semibold">{c.balance.toLocaleString("ru")} ₽</p>
                            <p className="text-muted-foreground">баланс</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {clientsPages > 1 && (
                    <div className="flex items-center justify-center gap-2">
                      <button disabled={clientsPage <= 1} onClick={() => fetchClients(clientsPage - 1, clientsSearch)}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white disabled:opacity-30 text-sm transition-colors">
                        <Icon name="ChevronLeft" size={16} />
                      </button>
                      <span className="text-sm text-muted-foreground">стр. {clientsPage} из {clientsPages}</span>
                      <button disabled={clientsPage >= clientsPages} onClick={() => fetchClients(clientsPage + 1, clientsSearch)}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white disabled:opacity-30 text-sm transition-colors">
                        <Icon name="ChevronRight" size={16} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {tab === "notify" && (
            <div>
              <h2 className="font-oswald text-3xl font-bold text-white mb-6">Рассылка уведомлений</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card-glow rounded-2xl p-6">
                  <h3 className="font-semibold text-white mb-4 flex items-center gap-2"><Icon name="Send" size={16} className="text-purple-400" />Новое сообщение</h3>
                  <form onSubmit={handleSendNotify} className="space-y-4">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wider">Тип</label>
                      <select value={notifyType} onChange={e => setNotifyType(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-4 py-2.5 text-white text-sm outline-none">
                        <option value="info">ℹ️ Информация</option>
                        <option value="promo">🎁 Акция / Предложение</option>
                        <option value="raffle">🎰 Новый розыгрыш</option>
                        <option value="winner">🏆 Победитель</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wider">Заголовок</label>
                      <input required value={notifyTitle} onChange={e => setNotifyTitle(e.target.value)} placeholder="Например: Новый розыгрыш iPhone!"
                        className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-4 py-2.5 text-white placeholder-muted-foreground text-sm outline-none" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wider">Текст сообщения</label>
                      <textarea required value={notifyMsg} onChange={e => setNotifyMsg(e.target.value)} rows={4} placeholder="Текст который получат все клиенты в Telegram..."
                        className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-4 py-2.5 text-white placeholder-muted-foreground text-sm outline-none resize-none" />
                    </div>
                    {notifyResult && (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-emerald-400 text-sm flex items-center gap-2">
                        <Icon name="CheckCircle" size={16} />Отправлено {notifyResult.sent} из {notifyResult.total} клиентов
                      </div>
                    )}
                    <button type="submit" disabled={sendingNotify}
                      className="w-full grad-btn rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-70">
                      {sendingNotify ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Отправка...</> : <><Icon name="Send" size={15} />Разослать всем клиентам</>}
                    </button>
                  </form>
                </div>
                <div className="card-glow rounded-2xl p-6">
                  <h3 className="font-semibold text-white mb-4 flex items-center gap-2"><Icon name="History" size={16} className="text-cyan-400" />История рассылок</h3>
                  {loadingHistory ? (
                    <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" /></div>
                  ) : notifyHistory.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-8">Рассылок ещё не было</p>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                      {notifyHistory.map(n => (
                        <div key={n.id} className="bg-white/5 rounded-xl p-3">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-white text-sm font-medium">{n.title}</p>
                            <span className="text-xs text-muted-foreground shrink-0">{n.sent_at.slice(0, 10)}</span>
                          </div>
                          <p className="text-muted-foreground text-xs line-clamp-2 mb-1.5">{n.message}</p>
                          <p className="text-xs text-purple-400">Получили: {n.recipients_count} чел.</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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