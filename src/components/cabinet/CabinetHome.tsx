import Icon from "@/components/ui/icon";
import {
  SITE_PHONE, LINK_TG, LINK_WA, LINK_MAX, CAR_IMG,
} from "./cabinetShared";

interface Props {
  name: string;
  phone: string;
  activeCount: number;
  doneCount: number;
  rating?: number;
  clientSince?: string;
  onNew: () => void;
  onTrips: () => void;
  onReview: () => void;
  onProfile: () => void;
  onLogout: () => void;
}

const MENU = [
  { key: "trips", icon: "Clock", label: "История заказов" },
  { key: "review", icon: "MessageSquare", label: "Оставить отзыв" },
  { key: "profile", icon: "User", label: "Профиль" },
  { key: "logout", icon: "LogOut", label: "Выйти" },
] as const;

export default function CabinetHome({
  name, phone, activeCount, doneCount, rating = 4.9, clientSince = "2025",
  onNew, onTrips, onReview, onProfile, onLogout,
}: Props) {
  const handle = (key: string) => {
    if (key === "trips") onTrips();
    else if (key === "review") onReview();
    else if (key === "profile") onProfile();
    else if (key === "logout") onLogout();
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-5 space-y-5">
      {/* top bar */}
      <div className="flex items-center justify-between gap-2">
        <a
          href={`tel:${phone.replace(/[^\d+]/g, "")}`}
          className="flex items-center gap-2 rounded-full border border-amber-400/60 px-4 py-2 text-amber-300 font-bold text-sm whitespace-nowrap"
        >
          {SITE_PHONE}
        </a>
        <div className="flex items-center gap-2">
          <a href={LINK_TG} target="_blank" rel="noopener noreferrer" aria-label="Telegram" className="w-10 h-10 rounded-full bg-[#2AABEE] flex items-center justify-center">
            <Icon name="Send" size={18} className="text-white" />
          </a>
          <a href={LINK_WA} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center">
            <Icon name="MessageCircle" size={18} className="text-white" />
          </a>
          <a href={LINK_MAX} target="_blank" rel="noopener noreferrer" aria-label="MAX" className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7C4DFF] to-[#4D7CFF] flex items-center justify-center">
            <span className="text-white text-[10px] font-bold leading-none">MAX</span>
          </a>
        </div>
      </div>

      {/* profile */}
      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          <div className="w-24 h-24 rounded-full border-[3px] border-amber-400 overflow-hidden bg-amber-500/10 flex items-center justify-center">
            <Icon name="UserRound" size={44} className="text-amber-400" />
          </div>
          <button
            onClick={onProfile}
            aria-label="Редактировать"
            className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-amber-400 border-4 border-[#0d0d0d] flex items-center justify-center"
          >
            <Icon name="Pencil" size={13} className="text-black" />
          </button>
        </div>
        <div className="flex-1 min-w-0 pt-1">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-2xl font-bold text-white truncate">{name || "Клиент"}</h1>
            <div className="relative shrink-0">
              <Icon name="Bell" size={24} className="text-amber-400" />
              {activeCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-black text-[11px] font-bold flex items-center justify-center">
                  {activeCount}
                </span>
              )}
            </div>
          </div>
          <div className="text-white/70 text-base mt-0.5">{phone}</div>
          <div className="flex items-center gap-4 mt-2 text-sm">
            <span className="flex items-center gap-1 text-white">
              <Icon name="Star" size={15} className="text-amber-400 fill-amber-400" /> {rating}
            </span>
            <span className="flex items-center gap-1.5 text-white/60">
              <Icon name="CalendarDays" size={15} className="text-white/40" /> С {clientSince} года
            </span>
          </div>
        </div>
      </div>

      {/* hero banner */}
      <div className="relative rounded-3xl border border-white/10 bg-[#161616] overflow-hidden p-5">
        <div className="relative z-10 max-w-[62%]">
          <h2 className="text-white text-2xl font-extrabold leading-tight">Комфортные поездки с нами</h2>
          <p className="text-white/50 text-sm mt-2 leading-snug">
            Быстрый поиск, проверенные водители и высокий рейтинг
          </p>
          <button
            onClick={onNew}
            className="mt-4 inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-black font-bold rounded-xl px-5 py-3 transition-colors"
          >
            Заказать такси <Icon name="ArrowRight" size={18} />
          </button>
        </div>
        <img
          src={CAR_IMG}
          alt="Такси"
          className="pointer-events-none absolute right-0 bottom-2 w-[52%] max-w-[260px] object-contain"
        />
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={onTrips} className="flex items-center gap-3 rounded-2xl bg-[#161616] border border-white/10 p-4 text-left">
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
            <Icon name="Lock" size={20} className="text-amber-400" />
          </div>
          <div>
            <div className="text-white/60 text-xs">Активные заказы</div>
            <div className="text-white text-xl font-bold">{activeCount}</div>
          </div>
          <Icon name="ChevronRight" size={18} className="text-amber-400 ml-auto" />
        </button>
        <button onClick={onTrips} className="flex items-center gap-3 rounded-2xl bg-[#161616] border border-white/10 p-4 text-left">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
            <Icon name="CheckCheck" size={20} className="text-emerald-400" />
          </div>
          <div>
            <div className="text-white/60 text-xs">Выполнено</div>
            <div className="text-white text-xl font-bold">{doneCount}</div>
          </div>
          <Icon name="ChevronRight" size={18} className="text-amber-400 ml-auto" />
        </button>
      </div>

      {/* menu list */}
      <div className="rounded-3xl bg-[#161616] border border-white/10 overflow-hidden divide-y divide-white/5">
        {MENU.map((m) => (
          <button
            key={m.key}
            onClick={() => handle(m.key)}
            className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/5 ${
              m.key === "logout" ? "text-red-400" : "text-white"
            }`}
          >
            <Icon name={m.icon} size={22} className={m.key === "logout" ? "text-red-400" : "text-amber-400"} />
            <span className="flex-1 text-lg font-medium">{m.label}</span>
            <Icon name="ChevronRight" size={20} className={m.key === "logout" ? "text-red-400/60" : "text-amber-400"} />
          </button>
        ))}
      </div>
    </div>
  );
}
