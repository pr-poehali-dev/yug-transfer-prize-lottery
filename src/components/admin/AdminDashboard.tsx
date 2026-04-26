import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { RaffleFormModal } from "./RaffleFormModal";
import {
  RAFFLES_URL, ADMIN_STATS_URL, ADMIN_CLIENTS_URL, SPIN_URL, JACKPOT_URL,
  AdminTab, AdminStats, Client, RaffleDB,
} from "./adminTypes";
import { AdminDashboardTab } from "./AdminDashboardTab";
import { AdminClientsTab } from "./AdminClientsTab";
import { AdminRafflesTab } from "./AdminRafflesTab";
import { AdminJackpotTab } from "./AdminJackpotTab";
import { AdminPostsTab } from "./AdminPostsTab";
import { AdminBotTab } from "./AdminBotTab";
import { AdminDriversTab } from "./AdminDriversTab";

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

  // Jackpot
  const [jackpot, setJackpot] = useState<{ balance: number; next_draw_at: string | null; last_winner: string | null } | null>(null);

  // Clients
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsTotal, setClientsTotal] = useState(0);
  const [clientsPage, setClientsPage] = useState(1);
  const [clientsPages, setClientsPages] = useState(1);
  const [clientsSearch, setClientsSearch] = useState("");
  const [loadingClients, setLoadingClients] = useState(false);



  const fetchRaffles = async () => {
    setLoadingRaffles(true);
    try {
      const res = await fetch(RAFFLES_URL, { headers: { 'X-Admin-Token': token } });
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



  useEffect(() => { fetchRaffles(); }, []);
  useEffect(() => {
    if (tab === "dashboard") {
      fetchStats();
      fetch(JACKPOT_URL).then(r => r.json()).then(d => { if (d.ok) setJackpot(d); }).catch(() => {});
    }
  }, [tab]);
  useEffect(() => { if (tab === "clients") fetchClients(1, clientsSearch); }, [tab]);


  const handleSave = (r: RaffleDB) => {
    setRaffles(prev => {
      const idx = prev.findIndex(x => x.id === r.id);
      return idx >= 0 ? prev.map(x => x.id === r.id ? r : x) : [r, ...prev];
    });
    setFormOpen(false); setEditTarget(undefined);
  };

  const handleFinish = async (r: RaffleDB) => {
    if (!confirm(`Запустить колесо рулетки для розыгрыша "${r.title}"?\n\nКолесо будет крутиться 30 секунд на сайте в реальном времени. Победитель выбирается автоматически из участников.`)) return;
    setFinishing(r.id);
    try {
      // 1. Запускаем спин — колесо крутится на сайте, победитель выбирается случайно
      const spinRes = await fetch(SPIN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify({ raffle_id: r.id, raffle_title: r.title, photo_url: r.photo_url || "" }),
      });
      const spinData = await spinRes.json();
      if (!spinData.ok) { alert("Ошибка запуска спина: " + (spinData.error || "")); return; }

      const winner = spinData.winner_name || "";
      if (spinData.spin) {
        window.dispatchEvent(new CustomEvent("spin:start", { detail: spinData.spin }));
      }
      setTimeout(async () => {
        const res = await fetch(RAFFLES_URL, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "X-Admin-Token": token },
          body: JSON.stringify({ ...r, id: r.id, status: "ended", winner }),
        });
        const data = await res.json();
        if (data.ok) setRaffles(prev => prev.map(x => x.id === r.id ? data.raffle : x));
      }, 32_000);

      alert(`✅ Колесо запущено! Победитель будет объявлен через 30 секунд.\nИмя победителя: ${winner}`);
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

  const TABS = [
    { id: "dashboard" as AdminTab, label: "Обзор", icon: "LayoutDashboard" },
    { id: "raffles" as AdminTab, label: "Розыгрыши", icon: "Gift" },
    { id: "clients" as AdminTab, label: "Клиенты", icon: "Users" },

    { id: "jackpot" as AdminTab, label: "Джекпот", icon: "Gem" },
    { id: "posts" as AdminTab, label: "Посты в канал", icon: "Send" },
    { id: "bot" as AdminTab, label: "Наш бот", icon: "Bot" },
    { id: "drivers" as AdminTab, label: "Водители", icon: "Car" },
  ];

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
            <AdminDashboardTab stats={stats} loadingStats={loadingStats} raffles={raffles} jackpot={jackpot} />
          )}

          {tab === "clients" && (
            <AdminClientsTab
              clients={clients}
              clientsTotal={clientsTotal}
              clientsPage={clientsPage}
              clientsPages={clientsPages}
              clientsSearch={clientsSearch}
              loadingClients={loadingClients}
              token={token}
              onSearchChange={search => { setClientsSearch(search); fetchClients(1, search); }}
              onPageChange={page => fetchClients(page, clientsSearch)}
              onDeleted={id => { setClients(prev => prev.filter(c => c.id !== id)); setClientsTotal(t => t - 1); }}
            />
          )}

          {tab === "raffles" && (
            <AdminRafflesTab
              raffles={raffles}
              loadingRaffles={loadingRaffles}
              finishing={finishing}
              deleting={deleting}
              raffleStats={stats?.raffle_stats}
              onAdd={() => { setEditTarget(undefined); setFormOpen(true); }}
              onEdit={r => { setEditTarget(r); setFormOpen(true); }}
              onFinish={handleFinish}
              onDelete={handleDelete}
            />
          )}

          {tab === "jackpot" && (
            <AdminJackpotTab token={token} />
          )}

          {tab === "posts" && (
            <AdminPostsTab token={token} />
          )}

          {tab === "bot" && (
            <AdminBotTab token={token} />
          )}

          {tab === "drivers" && (
            <AdminDriversTab token={token} />
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