import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import type { AppUser } from "@/pages/Index";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const CABINET_URL = "https://functions.poehali.dev/0ad2d0a9-bb39-4116-9934-9460e7841500";
const AUTH_URL = "https://functions.poehali.dev/3668a161-208c-46c4-8691-84fa9d9586b0";

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
  const [imgError, setImgError] = useState(false);
  if (user.photo_url && !imgError) {
    return <img src={user.photo_url} alt={fullName} onError={() => setImgError(true)} className="rounded-2xl object-cover border-2 border-purple-500/40" style={{ width: size, height: size }} />;
  }
  return (
    <div className="rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {user.first_name[0]?.toUpperCase() || "?"}
    </div>
  );
}

const AUTH_LINK_URL = "https://functions.poehali.dev/3668a161-208c-46c4-8691-84fa9d9586b0";

interface TgUser { id: number; first_name: string; username?: string; hash: string; auth_date: number; }
declare global { interface Window { onTgLink: (u: TgUser) => void; } }

function TgLinkWidget({ userId, onLinked }: { userId: number; onLinked: (tgId: number, username?: string) => void }) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    window.onTgLink = async (tgUser: TgUser) => {
      setLoading(true);
      try {
        const res = await fetch(AUTH_LINK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'link_telegram', user_id: String(userId), telegram_id: String(tgUser.id), username: tgUser.username || '', hash: tgUser.hash }),
        });
        const data = await res.json();
        if (data.ok) onLinked(tgUser.id, tgUser.username);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };

    const handleMsg = (e: MessageEvent) => {
      if (!String(e.origin).includes('telegram.org')) return;
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data?.id) window.onTgLink(data as TgUser);
      } catch { /* ignore */ }
    };
    window.addEventListener('message', handleMsg);
    return () => {
      window.removeEventListener('message', handleMsg);
      delete (window as Window & typeof globalThis).onTgLink;
    };
  }, [userId]);

  const handleClick = () => {
    const origin = encodeURIComponent(window.location.origin);
    window.open(`https://oauth.telegram.org/auth?bot_id=8567041422&origin=${origin}&request_access=write&lang=ru`, 'tg_link', 'width=550,height=470,scrollbars=no');
  };

  return (
    <button onClick={handleClick} disabled={loading}
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-[#2AABEE]/30 text-[#2AABEE] bg-[#2AABEE]/10 hover:bg-[#2AABEE]/20 transition-all disabled:opacity-50">
      {loading
        ? <div className="w-3 h-3 border border-[#2AABEE]/30 border-t-[#2AABEE] rounded-full animate-spin" />
        : <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 13.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.828.942z"/></svg>
      }
      Привязать Telegram
    </button>
  );
}

function EditProfileModal({ user, onClose, onSave }: { user: AppUser; onClose: () => void; onSave: (u: AppUser) => void }) {
  const [name, setName] = useState(user.first_name || '');
  const [phone, setPhone] = useState((user as AppUser & {phone?: string}).phone || '');
  const [newPassword, setNewPassword] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [photoUrl, setPhotoUrl] = useState(user.photo_url || '');
  const [loading, setLoading] = useState(false);
  const [tgLinking, setTgLinking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const hasTg = !!(user.telegram_id && user.telegram_id !== 0);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleLinkTelegram = () => {
    setTgLinking(true);
    setError(''); setSuccess('');
    const origin = encodeURIComponent(window.location.origin);
    // Сохраняем user_id чтобы после редиректа привязать TG к аккаунту
    localStorage.setItem('tg_link_user_id', String(user.id));
    window.location.href = `https://oauth.telegram.org/auth?bot_id=${TG_BOT_ID}&origin=${origin}&request_access=write&lang=ru`;
  };

  const handleSave = async () => {
    setLoading(true); setError(''); setSuccess('');
    try {
      const body: Record<string, string> = { action: 'update_profile', user_id: String(user.id), first_name: name };
      if (phone) body.phone = phone.replace(/\D/g, '');
      if (newPassword) { body.new_password = newPassword; body.old_password = oldPassword; }
      if (photoUrl && photoUrl.startsWith('data:')) body.photo_data = photoUrl;
      const res = await fetch(AUTH_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.ok) {
        setSuccess('Профиль сохранён!');
        onSave({ ...user, first_name: name, photo_url: data.photo_url || photoUrl });
      } else {
        setError(data.error || 'Ошибка сохранения');
      }
    } catch { setError('Ошибка соединения'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm">
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 rounded-3xl blur-lg opacity-40" />
        <div className="relative glass rounded-3xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-oswald text-xl font-bold text-white">Редактировать профиль</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-full glass flex items-center justify-center text-muted-foreground hover:text-white">
              <Icon name="X" size={16} />
            </button>
          </div>

          {/* Фото */}
          <div className="flex flex-col items-center mb-5">
            <div className="relative cursor-pointer" onClick={() => fileRef.current?.click()}>
              {photoUrl ? (
                <img src={photoUrl} className="w-20 h-20 rounded-2xl object-cover border-2 border-purple-500/40" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl font-bold text-white">
                  {name[0]?.toUpperCase() || '?'}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-purple-500 rounded-full flex items-center justify-center border-2 border-background">
                <Icon name="Camera" size={13} className="text-white" />
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            <p className="text-xs text-muted-foreground mt-2">Нажми на фото чтобы изменить</p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block uppercase tracking-wider">Имя</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ваше имя"
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-4 py-2.5 text-white text-sm outline-none" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block uppercase tracking-wider">Номер телефона</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 (___) ___-__-__"
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-4 py-2.5 text-white text-sm outline-none" />
            </div>
            <div className="border-t border-white/10 pt-3">
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Сменить пароль</p>
              <input value={oldPassword} onChange={e => setOldPassword(e.target.value)} type="password" placeholder="Текущий пароль"
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-4 py-2.5 text-white text-sm outline-none mb-2" />
              <input value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password" placeholder="Новый пароль"
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-4 py-2.5 text-white text-sm outline-none" />
            </div>
          </div>

          {/* Привязка Telegram */}
          <div className="border-t border-white/10 pt-3 mt-1">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Telegram</p>
            {hasTg ? (
              <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#2AABEE"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 13.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.828.942z"/></svg>
                <span className="text-emerald-400 text-sm font-medium">Telegram привязан</span>
                <Icon name="Check" size={14} className="text-emerald-400 ml-auto" />
              </div>
            ) : (
              <button onClick={handleLinkTelegram} disabled={tgLinking}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-[#2AABEE]/40 bg-[#2AABEE]/10 hover:bg-[#2AABEE]/20 text-[#2AABEE] transition-all text-sm font-semibold disabled:opacity-70">
                {tgLinking ? <div className="w-4 h-4 border-2 border-[#2AABEE]/30 border-t-[#2AABEE] rounded-full animate-spin" /> : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 13.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.828.942z"/></svg>
                )}
                Привязать Telegram
              </button>
            )}
          </div>

          {error && <p className="text-red-400 text-sm text-center mt-3">{error}</p>}
          {success && <p className="text-emerald-400 text-sm text-center mt-3">{success}</p>}

          <button onClick={handleSave} disabled={loading}
            className="w-full grad-btn rounded-xl py-3 font-bold mt-4 flex items-center justify-center gap-2 disabled:opacity-70">
            {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Сохранение...</> : <><Icon name="Save" size={16} />Сохранить</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CabinetSection({ user, onLogin, onLogout, onUserUpdate }: CabinetSectionProps) {
  const [tab, setTab] = useState<"entries" | "transactions" | "wins">("entries");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
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
      {editOpen && user && (
        <EditProfileModal
          user={user}
          onClose={() => setEditOpen(false)}
          onSave={(updated) => { onUserUpdate(updated); setEditOpen(false); }}
        />
      )}

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
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setEditOpen(true)} className="p-2.5 rounded-xl glass text-muted-foreground hover:text-purple-400 transition-colors" title="Редактировать профиль">
              <Icon name="Pencil" size={18} />
            </button>
            <button onClick={onLogout} className="p-2.5 rounded-xl glass text-muted-foreground hover:text-red-400 transition-colors" title="Выйти">
              <Icon name="LogOut" size={18} />
            </button>
          </div>
        </div>

        {/* Баланс + пополнение */}
        <div className="mt-5 pt-5 border-t border-white/10 flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Баланс</p>
            <p className="font-oswald text-3xl font-bold grad-text">{user.balance.toLocaleString("ru")} ₽</p>
          </div>
          <div className="flex flex-col gap-2 items-end">
            {/* Привязка Telegram */}
            {user.telegram_id && user.telegram_id !== 0 ? (
              <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-[#2AABEE]/30 text-[#2AABEE] bg-[#2AABEE]/10">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 13.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.828.942z"/></svg>
                Telegram привязан ✓
              </div>
            ) : (
              <TgLinkWidget userId={user.id} onLinked={(tgId, username) => {
                onUserUpdate({ ...user, telegram_id: tgId, username: username || user.username });
              }} />
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-1.5">
              <Icon name="Clock" size={13} />
              Пополнение скоро
            </div>
            {pushSupported && pushStatus !== "denied" && (
              <button
                onClick={pushStatus === "subscribed" ? pushUnsubscribe : pushSubscribe}
                disabled={pushStatus === "loading"}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition-all disabled:opacity-50 ${pushStatus === "subscribed" ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10" : "border-white/10 text-muted-foreground glass hover:text-white"}`}
              >
                {pushStatus === "loading"
                  ? <><div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />Подключение...</>
                  : <><Icon name={pushStatus === "subscribed" ? "Bell" : "BellOff"} size={13} />{pushStatus === "subscribed" ? "Уведомления вкл" : "Включить уведомления"}</>
                }
              </button>
            )}
            {pushStatus === "denied" && (
              <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-red-500/20 text-red-400/70 bg-red-500/5">
                <Icon name="BellOff" size={13} />
                Уведомления заблокированы
              </div>
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