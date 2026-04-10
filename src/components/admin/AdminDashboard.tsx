import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { RaffleFormModal } from "./RaffleFormModal";
import {
  RAFFLES_URL, ADMIN_STATS_URL, ADMIN_CLIENTS_URL, ADMIN_NOTIFY_URL, PUSH_URL,
  AdminTab, AdminStats, Client, Notification, RaffleDB,
} from "./adminTypes";

export function AdminDashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [tab, setTab] = useState<AdminTab>("raffles");
  const [raffles, setRaffles] = useState<RaffleDB[]>([]);
  const [loadingRaffles, setLoadingRaffles] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RaffleDB | undefined>();
  const [deleting, setDeleting] = useState<number | null>(null);
  const [finishing, setFinishing] = useState<number | null>(null);

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
  const [sendPush, setSendPush] = useState(true);
  const [pushCount, setPushCount] = useState<number | null>(null);
  const [pushResult, setPushResult] = useState<{ sent: number; total: number } | null>(null);

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

  const fetchPushCount = async () => {
    try {
      const res = await fetch(PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify({ action: "count" }),
      });
      const data = await res.json();
      if (data.ok) setPushCount(data.count);
    } catch { /**/ }
  };

  const handleSendNotify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifyTitle.trim() || !notifyMsg.trim()) return;
    setSendingNotify(true); setNotifyResult(null); setPushResult(null);
    try {
      const [tgRes] = await Promise.all([
        fetch(ADMIN_NOTIFY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Admin-Token": token },
          body: JSON.stringify({ title: notifyTitle, message: notifyMsg, type: notifyType }),
        }),
        sendPush ? fetch(PUSH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Admin-Token": token },
          body: JSON.stringify({ action: "send", title: notifyTitle, message: notifyMsg, url: "/" }),
        }).then(r => r.json()).then(d => { if (d.ok) setPushResult({ sent: d.sent, total: d.total }); }) : Promise.resolve(),
      ]);
      const data = await tgRes.json();
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
  useEffect(() => { if (tab === "notify") { fetchNotifyHistory(); fetchPushCount(); } }, [tab]);

  const handleSave = (r: RaffleDB) => {
    setRaffles(prev => {
      const idx = prev.findIndex(x => x.id === r.id);
      return idx >= 0 ? prev.map(x => x.id === r.id ? r : x) : [r, ...prev];
    });
    setFormOpen(false); setEditTarget(undefined);
  };

  const handleFinish = async (r: RaffleDB) => {
    const winner = prompt(`Завершить розыгрыш "${r.title}"?\n\nВведи имя победителя (или оставь пустым):`);
    if (winner === null) return;
    setFinishing(r.id);
    try {
      const res = await fetch(RAFFLES_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify({ ...r, id: r.id, status: "ended", winner: winner || "" }),
      });
      const data = await res.json();
      if (data.ok) setRaffles(prev => prev.map(x => x.id === r.id ? data.raffle : x));
    } finally { setFinishing(null); }
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
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <div className={`w-10 h-6 rounded-full transition-colors relative ${sendPush ? "bg-purple-500" : "bg-white/10"}`}
                        onClick={() => setSendPush(v => !v)}>
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${sendPush ? "translate-x-5" : "translate-x-1"}`} />
                      </div>
                      <div>
                        <p className="text-sm text-white">Browser Push</p>
                        <p className="text-xs text-muted-foreground">
                          {pushCount !== null ? `${pushCount} подписчиков в браузере` : "Загрузка..."}
                        </p>
                      </div>
                    </label>
                    {notifyResult && (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-emerald-400 text-sm flex items-center gap-2">
                        <Icon name="CheckCircle" size={16} />Telegram: {notifyResult.sent} из {notifyResult.total}
                        {pushResult && <span className="ml-2 text-purple-300">· Browser Push: {pushResult.sent}</span>}
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
                        {r.status === "active" && (
                          <button onClick={() => handleFinish(r)} disabled={finishing === r.id}
                            className="h-8 px-2.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 flex items-center gap-1.5 text-orange-400 transition-colors disabled:opacity-40 text-xs font-medium">
                            {finishing === r.id
                              ? <div className="w-3 h-3 border border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
                              : <Icon name="FlagTriangleRight" size={13} />}
                            Завершить
                          </button>
                        )}
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