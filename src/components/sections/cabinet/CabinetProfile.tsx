import { useState } from "react";
import Icon from "@/components/ui/icon";
import type { AppUser } from "@/pages/Index";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const TG_BOT_USERNAME = "UG_GIFTBOT";
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

        {/* Привязка Telegram */}
        {!user.telegram_id || user.telegram_id === 0 ? (
          <div className="mt-4 pt-4 border-t border-white/10">
            <a
              href={`https://t.me/${TG_BOT_USERNAME}?start=link_${user.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 w-full p-3 rounded-2xl bg-[#2AABEE]/15 border border-[#2AABEE]/30 hover:bg-[#2AABEE]/25 transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-[#2AABEE] flex items-center justify-center shrink-0">
                <Icon name="Send" size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white group-hover:text-[#2AABEE] transition-colors">Подключить Telegram</p>
                <p className="text-xs text-muted-foreground">Получай уведомления о розыгрышах</p>
              </div>
              <Icon name="ChevronRight" size={18} className="text-muted-foreground group-hover:text-[#2AABEE] transition-colors shrink-0" />
            </a>
          </div>
        ) : (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                <Icon name="Check" size={18} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-400">Telegram подключён</p>
                {user.username && <p className="text-xs text-muted-foreground">@{user.username}</p>}
              </div>
            </div>
          </div>
        )}
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