import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import type { AppUser } from "@/pages/Index";
import { CABINET_URL, Entry, Transaction } from "./cabinet/cabinet-types";
import { CabinetProfile } from "./cabinet/CabinetProfile";
import { CabinetTabs } from "./cabinet/CabinetTabs";
import { EditProfileModal } from "./cabinet/EditProfileModal";

const PAYMENT_URL = "https://functions.poehali.dev/81f8c74e-7d9c-47ff-8dfc-8f0e3dd7a155";
const MAX_POLL = 10;
const POLL_INTERVAL = 2500;

interface CabinetSectionProps {
  user: AppUser | null;
  onLogin: () => void;
  onLogout: () => void;
  onUserUpdate: (user: AppUser) => void;
}

type PaymentNotice = "checking" | "success" | "pending" | "failed" | null;

export function CabinetSection({ user, onLogin, onLogout, onUserUpdate }: CabinetSectionProps) {
  const [tab, setTab] = useState<"entries" | "transactions" | "wins">("entries");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [notice, setNotice] = useState<PaymentNotice>(null);
  const pollRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reloadCabinet = (uid: number) => {
    Promise.all([
      fetch(`${CABINET_URL}?entries`, { headers: { "X-User-Id": String(uid) } }).then(r => r.json()),
      fetch(`${CABINET_URL}?transactions`, { headers: { "X-User-Id": String(uid) } }).then(r => r.json()),
      fetch(CABINET_URL, { headers: { "X-User-Id": String(uid) } }).then(r => r.json()),
    ]).then(([e, t, u]) => {
      if (e.ok) setEntries(e.entries || []);
      if (t.ok) setTransactions((t.transactions || []).filter((tx: Transaction) => tx.status === "completed"));
      if (u.ok) onUserUpdate(u.user as AppUser);
    }).catch(() => {});
  };

  const pollPayment = (paymentId: string, uid: number, attempt: number) => {
    if (attempt >= MAX_POLL) {
      setNotice("pending");
      sessionStorage.removeItem("pending_payment_id");
      return;
    }
    fetch(`${PAYMENT_URL}?action=check&payment_id=${paymentId}`)
      .then(r => r.json())
      .then(d => {
        if (d.status === "succeeded") {
          setNotice("success");
          setTab("entries");
          sessionStorage.removeItem("pending_payment_id");
          reloadCabinet(uid);
        } else if (d.status === "canceled") {
          setNotice("failed");
          sessionStorage.removeItem("pending_payment_id");
        } else {
          timerRef.current = setTimeout(() => pollPayment(paymentId, uid, attempt + 1), POLL_INTERVAL);
        }
      })
      .catch(() => {
        timerRef.current = setTimeout(() => pollPayment(paymentId, uid, attempt + 1), POLL_INTERVAL);
      });
  };

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      fetch(`${CABINET_URL}?entries`, { headers: { "X-User-Id": String(user.id) } }).then(r => r.json()),
      fetch(`${CABINET_URL}?transactions`, { headers: { "X-User-Id": String(user.id) } }).then(r => r.json()),
    ]).then(([e, t]) => {
      if (e.ok) setEntries(e.entries || []);
      if (t.ok) setTransactions((t.transactions || []).filter((tx: Transaction) => tx.status === "completed"));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const onFocus = () => reloadCabinet(user.id);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const isReturn = params.get("payment") === "success";
    const storedPid = sessionStorage.getItem("pending_payment_id");

    if (isReturn) {
      window.history.replaceState({}, "", window.location.pathname);
      if (storedPid) {
        setNotice("checking");
        pollRef.current = 0;
        pollPayment(storedPid, user.id, 0);
      } else {
        reloadCabinet(user.id);
      }
    }

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [user?.id]);

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

      {/* Уведомление об оплате */}
      {notice && (
        <div className={`rounded-2xl p-4 flex items-center gap-3 border transition-all ${
          notice === "success"
            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
            : notice === "failed"
            ? "bg-red-500/15 border-red-500/30 text-red-400"
            : "bg-blue-500/15 border-blue-500/30 text-blue-300"
        }`}>
          {notice === "checking" && (
            <>
              <Icon name="Loader" size={20} className="animate-spin shrink-0" />
              <span className="font-medium">Проверяем оплату...</span>
            </>
          )}
          {notice === "success" && (
            <>
              <Icon name="CheckCircle" size={20} className="shrink-0" />
              <div>
                <p className="font-bold">Оплата прошла успешно!</p>
                <p className="text-sm opacity-80">Ваш билет зарегистрирован — участвуете в розыгрыше</p>
              </div>
            </>
          )}
          {notice === "pending" && (
            <>
              <Icon name="Clock" size={20} className="shrink-0" />
              <div>
                <p className="font-bold">Платёж обрабатывается</p>
                <p className="text-sm opacity-80">Билет появится в кабинете автоматически после подтверждения</p>
              </div>
            </>
          )}
          {notice === "failed" && (
            <>
              <Icon name="XCircle" size={20} className="shrink-0" />
              <div>
                <p className="font-bold">Оплата отменена</p>
                <p className="text-sm opacity-80">Билет не был выдан. Попробуйте снова.</p>
              </div>
            </>
          )}
          <button onClick={() => setNotice(null)} className="ml-auto shrink-0 opacity-60 hover:opacity-100">
            <Icon name="X" size={16} />
          </button>
        </div>
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