import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import type { AppUser } from "@/pages/Index";
import { CABINET_URL, Entry, Transaction } from "./cabinet/cabinet-types";
import { CabinetProfile } from "./cabinet/CabinetProfile";
import { CabinetTabs } from "./cabinet/CabinetTabs";
import { EditProfileModal } from "./cabinet/EditProfileModal";

interface CabinetSectionProps {
  user: AppUser | null;
  onLogin: () => void;
  onLogout: () => void;
  onUserUpdate: (user: AppUser) => void;
}

export function CabinetSection({ user, onLogin, onLogout, onUserUpdate }: CabinetSectionProps) {
  const [tab, setTab] = useState<"entries" | "transactions" | "wins">("entries");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

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

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {editOpen && (
        <EditProfileModal
          user={user}
          onClose={() => setEditOpen(false)}
          onSave={(updated) => { onUserUpdate(updated); setEditOpen(false); }}
        />
      )}

      <CabinetProfile
        user={user}
        myWinsCount={myWins.length}
        activeEntriesCount={activeEntries.length}
        onEdit={() => setEditOpen(true)}
        onLogout={onLogout}
        onUserUpdate={onUserUpdate}
      />

      <CabinetTabs
        tab={tab}
        setTab={setTab}
        entries={entries}
        transactions={transactions}
        myWins={myWins}
        loading={loading}
      />
    </div>
  );
}
