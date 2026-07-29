import { useRef } from "react";
import SiteHeader from "@/components/SiteHeader";
import Icon from "@/components/ui/icon";
import {
  SITE_PHONE, LINK_TG, LINK_WA, LINK_MAX,
  ClientRequest, STATUS_STYLE,
} from "./cabinetShared";

interface Props {
  name: string;
  phone: string;
  avatar?: string;
  onUploadAvatar?: (file: File) => void;
  requests: ClientRequest[];
  activeOrders: ClientRequest[];
  doneCount: number;
  rating?: number;
  clientSince?: string;
  onTrips: () => void;
  onReview: () => void;
  onLogout: () => void;
}

const MENU = [
  { key: "new", icon: "Plus", label: "Новый заказ", accent: true },
  { key: "trips", icon: "AlignJustify", label: "Заказы" },
  { key: "review", icon: "Headphones", label: "Поддержка" },
  { key: "logout", icon: "LogOut", label: "Выйти", danger: true },
] as const;

export default function CabinetDesktop({
  name, phone, avatar, onUploadAvatar, requests, activeOrders, doneCount,
  rating = 4.9, clientSince = "2025", onTrips, onReview, onLogout,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const pickFile = () => fileRef.current?.click();
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && onUploadAvatar) onUploadAvatar(f);
    e.target.value = "";
  };
  const handle = (key: string) => {
    if (key === "new") { window.location.href = "/"; }
    else if (key === "trips") onTrips();
    else if (key === "review") onReview();
    else if (key === "logout") onLogout();
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      <SiteHeader />

      <div className="mx-auto w-full max-w-6xl px-6 py-8 grid grid-cols-[300px_1fr] gap-6 items-start">
        {/* ---------- LEFT: profile + menu ---------- */}
        <aside className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-[#161616] p-6 flex flex-col items-center text-center">
            <div className="relative">
              <button
                onClick={pickFile}
                className="w-28 h-28 rounded-full border-[3px] border-amber-400 overflow-hidden bg-amber-500/10 flex items-center justify-center"
                aria-label="Сменить фото"
              >
                {avatar ? (
                  <img src={avatar} alt="Фото профиля" className="w-full h-full object-cover" />
                ) : (
                  <Icon name="UserRound" size={50} className="text-amber-400" />
                )}
              </button>
              <button
                onClick={pickFile}
                aria-label="Загрузить фото"
                className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-amber-400 border-4 border-[#161616] flex items-center justify-center"
              >
                <Icon name="Pencil" size={13} className="text-black" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
            </div>

            <h1 className="text-xl font-bold text-white mt-4">{name || "Клиент"}</h1>
            <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="text-amber-300/90 text-sm mt-1 hover:text-amber-300">
              {phone}
            </a>
            <div className="flex items-center gap-4 mt-3 text-sm">
              <span className="flex items-center gap-1 text-white">
                <Icon name="Star" size={15} className="text-amber-400 fill-amber-400" /> {rating}
              </span>
              <span className="flex items-center gap-1.5 text-white/60">
                <Icon name="CalendarDays" size={15} className="text-white/40" /> С {clientSince} года
              </span>
            </div>

            <div className="flex items-center gap-2.5 mt-4">
              <a href={LINK_TG} target="_blank" rel="noopener noreferrer" aria-label="Telegram" className="w-9 h-9 rounded-full bg-[#2AABEE] flex items-center justify-center">
                <Icon name="Send" size={16} className="text-white" />
              </a>
              <a href={LINK_WA} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center">
                <Icon name="MessageCircle" size={16} className="text-white" />
              </a>
              <a href={LINK_MAX} target="_blank" rel="noopener noreferrer" aria-label="MAX" className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7C4DFF] to-[#4D7CFF] flex items-center justify-center">
                <span className="text-white text-[10px] font-bold leading-none">MAX</span>
              </a>
            </div>
          </div>

          <nav className="space-y-2.5">
            {MENU.map((m) => (
              <button
                key={m.key}
                onClick={() => handle(m.key)}
                className={`w-full flex items-center gap-3 rounded-xl px-4 py-3.5 font-semibold transition-colors border ${
                  m.accent
                    ? "bg-amber-400 hover:bg-amber-300 text-black border-transparent justify-center"
                    : m.danger
                    ? "bg-[#161616] border-white/10 text-red-400 hover:bg-red-500/10"
                    : "bg-[#161616] border-white/10 text-white hover:border-amber-500/40"
                }`}
              >
                <Icon name={m.icon} size={18} className={m.accent ? "text-black" : m.danger ? "text-red-400" : "text-amber-400"} />
                <span className="flex-1 text-left">{m.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* ---------- RIGHT: stats + active + history ---------- */}
        <main className="space-y-6">
          <div className="grid grid-cols-2 gap-5">
            <div className="flex items-center gap-4 rounded-2xl bg-[#161616] border border-white/10 p-5">
              <div className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                <Icon name="Lock" size={22} className="text-amber-400" />
              </div>
              <div>
                <div className="text-white/60 text-sm">Активные заказы</div>
                <div className="text-white text-2xl font-bold">{activeOrders.length}</div>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-2xl bg-[#161616] border border-white/10 p-5">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                <Icon name="CheckCheck" size={22} className="text-emerald-400" />
              </div>
              <div>
                <div className="text-white/60 text-sm">Выполнено</div>
                <div className="text-white text-2xl font-bold">{doneCount}</div>
              </div>
            </div>
          </div>

          {/* active orders */}
          <section className="rounded-2xl bg-[#161616] border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4">Активные заказы</h2>
            {activeOrders.length === 0 ? (
              <div className="py-12 text-center">
                <Icon name="MapPinned" size={44} className="text-amber-400/70 mx-auto mb-3" />
                <div className="text-white font-semibold text-lg">Активных заказов нет</div>
                <div className="text-white/50 text-sm mt-1">
                  Оформите поездку на <a href="/" className="text-amber-400 hover:underline">главной странице</a>
                </div>
                <a
                  href="/"
                  className="mt-5 inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl px-5 py-2.5 transition-colors"
                >
                  <Icon name="Plus" size={18} /> Новый заказ
                </a>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {activeOrders.map((req) => (
                  <div key={req.id} className="rounded-2xl border border-white/10 bg-[#1c1c1c] p-4 hover:border-amber-500/30 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-white font-semibold">Заказ №{req.id}</span>
                      <span className={`text-xs px-2.5 py-1 rounded-full border ${STATUS_STYLE[req.status] || "bg-white/10 text-white/70 border-white/20"}`}>
                        {req.status_label}
                      </span>
                    </div>
                    <div className="flex items-start gap-2 text-white/90 text-sm mb-2">
                      <Icon name="MapPin" size={16} className="text-amber-400 mt-0.5 shrink-0" />
                      <span>{req.from_city} <span className="text-white/40">→</span> {req.to_city}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-white/50 text-xs">
                      {(req.trip_date || req.trip_time) && <span>📅 {req.trip_date} {req.trip_time}</span>}
                      {req.tariff && <span>🎫 {req.tariff}</span>}
                      {req.people && <span>👤 {req.people}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* history table */}
          <section className="rounded-2xl bg-[#161616] border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4">История заказов</h2>
            {requests.length === 0 ? (
              <div className="py-8 text-center text-white/50 text-sm">Здесь появятся ваши прошлые поездки</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/40 text-left border-b border-white/10">
                      <th className="font-medium py-2.5 pr-4">№ заказа</th>
                      <th className="font-medium py-2.5 pr-4">Маршрут</th>
                      <th className="font-medium py-2.5 pr-4 whitespace-nowrap">Дата и время</th>
                      <th className="font-medium py-2.5 pr-4">Тариф</th>
                      <th className="font-medium py-2.5 pr-4">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((req) => (
                      <tr key={req.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                        <td className="py-3 pr-4 text-white/80">№{req.id}</td>
                        <td className="py-3 pr-4 text-white">{req.from_city} → {req.to_city}</td>
                        <td className="py-3 pr-4 text-white/60 whitespace-nowrap">{req.trip_date} {req.trip_time}</td>
                        <td className="py-3 pr-4 text-white/70">{req.tariff || "—"}</td>
                        <td className="py-3 pr-4">
                          <span className={`text-xs px-2.5 py-1 rounded-full border ${STATUS_STYLE[req.status] || "bg-white/10 text-white/70 border-white/20"}`}>
                            {req.status_label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="text-white/30 text-xs pl-1">Телефон поддержки: {SITE_PHONE}</div>
        </main>
      </div>
    </div>
  );
}