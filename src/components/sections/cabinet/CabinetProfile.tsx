import { useState } from "react";
import Icon from "@/components/ui/icon";
import type { AppUser } from "@/pages/Index";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { AUTH_LINK_URL, TgUser } from "./cabinet-types";

declare global { interface Window { onTgLink: (u: TgUser) => void; } }

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

function TgLinkWidget({ userId, onLinked }: { userId: number; onLinked: (tgId: number, username?: string) => void }) {
  const [loading, setLoading] = useState(false);

  useState(() => {
    window.onTgLink = async (tgUser: TgUser) => {
      setLoading(true);
      try {
        const res = await fetch(AUTH_LINK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "link_telegram", user_id: String(userId), telegram_id: String(tgUser.id), username: tgUser.username || "", hash: tgUser.hash }),
        });
        const data = await res.json();
        if (data.ok) onLinked(tgUser.id, tgUser.username);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };

    const handleMsg = (e: MessageEvent) => {
      if (!String(e.origin).includes("telegram.org")) return;
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data?.id) window.onTgLink(data as TgUser);
      } catch { /* ignore */ }
    };
    window.addEventListener("message", handleMsg);
    return () => {
      window.removeEventListener("message", handleMsg);
      delete (window as Window & typeof globalThis).onTgLink;
    };
  });

  const handleClick = () => {
    const origin = encodeURIComponent(window.location.origin);
    window.open(`https://oauth.telegram.org/auth?bot_id=8567041422&origin=${origin}&request_access=write&lang=ru`, "tg_link", "width=550,height=470,scrollbars=no");
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

interface CabinetProfileProps {
  user: AppUser;
  myWinsCount: number;
  activeEntriesCount: number;
  onEdit: () => void;
  onLogout: () => void;
  onUserUpdate: (user: AppUser) => void;
}

export function CabinetProfile({ user, myWinsCount, activeEntriesCount, onEdit, onLogout, onUserUpdate }: CabinetProfileProps) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");
  const { status: pushStatus, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe, isSupported: pushSupported } = usePushNotifications(user.id);

  return (
    <>
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
            <button onClick={onEdit} className="p-2.5 rounded-xl glass text-muted-foreground hover:text-purple-400 transition-colors" title="Редактировать профиль">
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
          { label: "Выигрышей", value: myWinsCount, icon: "Trophy", from: "from-yellow-500", to: "to-orange-500" },
          { label: "Потрачено", value: `${user.total_spent.toLocaleString("ru")} ₽`, icon: "CreditCard", from: "from-cyan-500", to: "to-blue-500" },
          { label: "Активных", value: activeEntriesCount, icon: "Zap", from: "from-green-500", to: "to-emerald-500" },
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
    </>
  );
}
