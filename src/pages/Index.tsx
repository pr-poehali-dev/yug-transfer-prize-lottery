import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";

type Section = "raffles" | "cabinet" | "history" | "contacts";
type RaffleStatus = "all" | "active" | "ended" | "upcoming";

interface Raffle {
  id: number;
  title: string;
  prize: string;
  prizeIcon: string;
  endDate: string;
  participants: number;
  minAmount: number;
  status: "active" | "ended" | "upcoming";
  gradient: string;
  winner?: string;
}

const RAFFLES: Raffle[] = [
  {
    id: 1,
    title: "Мегапризёр — iPhone 16 Pro",
    prize: "iPhone 16 Pro Max",
    prizeIcon: "Smartphone",
    endDate: "2026-04-30",
    participants: 2847,
    minAmount: 500,
    status: "active",
    gradient: "from-purple-600 via-pink-500 to-orange-400",
  },
  {
    id: 2,
    title: "Путешествие мечты",
    prize: "Тур в Дубай на двоих",
    prizeIcon: "Plane",
    endDate: "2026-05-15",
    participants: 1203,
    minAmount: 1000,
    status: "active",
    gradient: "from-cyan-500 via-blue-500 to-purple-600",
  },
  {
    id: 3,
    title: "Авто-розыгрыш",
    prize: "Kia K5 2025",
    prizeIcon: "Car",
    endDate: "2026-06-01",
    participants: 5621,
    minAmount: 2000,
    status: "upcoming",
    gradient: "from-orange-500 via-red-500 to-pink-600",
  },
  {
    id: 4,
    title: "Гаджет-пак",
    prize: "AirPods Pro + iPad",
    prizeIcon: "Headphones",
    endDate: "2026-03-31",
    participants: 3100,
    minAmount: 300,
    status: "ended",
    gradient: "from-green-500 via-teal-500 to-cyan-500",
    winner: "Алексей К.",
  },
  {
    id: 5,
    title: "Деньги — наличными",
    prize: "500 000 ₽",
    prizeIcon: "Banknote",
    endDate: "2026-04-20",
    participants: 9988,
    minAmount: 100,
    status: "active",
    gradient: "from-yellow-400 via-orange-400 to-red-500",
  },
  {
    id: 6,
    title: "PlayStation 5",
    prize: "PS5 + 5 игр",
    prizeIcon: "Gamepad2",
    endDate: "2026-02-28",
    participants: 4200,
    minAmount: 250,
    status: "ended",
    gradient: "from-blue-600 via-indigo-600 to-purple-600",
    winner: "Мария Т.",
  },
];

const HISTORY = [
  { id: 1, raffle: "Гаджет-пак", date: "31.03.2026", amount: 300, tickets: 3, status: "Не выиграл" },
  { id: 2, raffle: "Мегапризёр — iPhone 16 Pro", date: "10.04.2026", amount: 1000, tickets: 2, status: "Участвую" },
  { id: 3, raffle: "Деньги — наличными", date: "09.04.2026", amount: 500, tickets: 5, status: "Участвую" },
  { id: 4, raffle: "PlayStation 5", date: "20.02.2026", amount: 250, tickets: 1, status: "Не выиграл" },
  { id: 5, raffle: "Путешествие мечты", date: "12.04.2026", amount: 2000, tickets: 2, status: "Участвую" },
];

const NAV_ITEMS = [
  { id: "raffles" as Section, label: "Розыгрыши", icon: "Gift" },
  { id: "cabinet" as Section, label: "Кабинет", icon: "User" },
  { id: "history" as Section, label: "История", icon: "Clock" },
  { id: "contacts" as Section, label: "Контакты", icon: "MessageCircle" },
];

const TICKER_ITEMS = [
  "🎉 Алексей К. выиграл AirPods Pro",
  "🏆 Новый розыгрыш — Kia K5 2025",
  "🔥 9 988 участников в кэш-розыгрыше",
  "✈️ Мария Т. летит в Дубай",
  "💎 Розыгрыш iPhone — активен до 30 апреля",
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    active: { label: "Активен", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    ended: { label: "Завершён", color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
    upcoming: { label: "Скоро", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  };
  const s = map[status] || map.ended;
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${s.color}`}>
      {s.label}
    </span>
  );
}

function CountdownTimer({ endDate }: { endDate: string }) {
  const [time, setTime] = useState({ d: 0, h: 0, m: 0, s: 0 });

  useEffect(() => {
    const update = () => {
      const diff = new Date(endDate).getTime() - Date.now();
      if (diff <= 0) return;
      setTime({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [endDate]);

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="flex gap-1.5 items-center">
      {[{ v: time.d, l: "д" }, { v: time.h, l: "ч" }, { v: time.m, l: "м" }, { v: time.s, l: "с" }].map(({ v, l }) => (
        <div key={l} className="flex flex-col items-center">
          <span className="font-oswald text-lg font-bold text-white leading-none">{pad(v)}</span>
          <span className="text-[9px] text-muted-foreground">{l}</span>
        </div>
      ))}
    </div>
  );
}

function RaffleCard({ raffle, idx }: { raffle: Raffle; idx: number }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="card-glow rounded-2xl overflow-hidden cursor-pointer opacity-0-init animate-fade-in-up"
      style={{ animationDelay: `${idx * 0.1}s`, animationFillMode: "forwards" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={`h-2 bg-gradient-to-r ${raffle.gradient}`} />
      <div className="p-5">
        <div className="flex justify-between items-start mb-4">
          <div
            className={`w-12 h-12 rounded-xl bg-gradient-to-br ${raffle.gradient} flex items-center justify-center transition-transform duration-300 ${hovered ? "scale-110 rotate-3" : ""}`}
          >
            <Icon name={raffle.prizeIcon as string} size={22} className="text-white" fallback="Gift" />
          </div>
          <StatusBadge status={raffle.status} />
        </div>

        <h3 className="font-oswald text-xl font-semibold text-white mb-1 leading-tight">{raffle.title}</h3>
        <p className={`text-sm bg-gradient-to-r ${raffle.gradient} bg-clip-text text-transparent font-semibold mb-4`}>
          🏆 {raffle.prize}
        </p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="glass rounded-xl p-3">
            <p className="text-xs text-muted-foreground mb-0.5">Участники</p>
            <p className="font-oswald text-lg font-bold text-white">{raffle.participants.toLocaleString("ru")}</p>
          </div>
          <div className="glass rounded-xl p-3">
            <p className="text-xs text-muted-foreground mb-0.5">Мин. взнос</p>
            <p className="font-oswald text-lg font-bold text-white">{raffle.minAmount} ₽</p>
          </div>
        </div>

        {raffle.status === "active" && (
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-1.5">До окончания:</p>
            <CountdownTimer endDate={raffle.endDate} />
          </div>
        )}

        {raffle.winner && (
          <div className="mb-4 glass rounded-xl px-3 py-2 flex items-center gap-2">
            <span className="text-lg">🥇</span>
            <span className="text-sm text-white font-medium">Победитель: {raffle.winner}</span>
          </div>
        )}

        {raffle.status !== "ended" && (
          <button className="w-full grad-btn rounded-xl py-2.5 font-semibold text-sm font-golos">
            {raffle.status === "upcoming" ? "Напомнить мне" : "Участвовать"}
          </button>
        )}
      </div>
    </div>
  );
}

function RafflesSection() {
  const [statusFilter, setStatusFilter] = useState<RaffleStatus>("all");
  const [sortBy, setSortBy] = useState<"date" | "prize" | "amount" | "participants">("date");
  const [minAmount, setMinAmount] = useState(0);

  const statusOptions: { value: RaffleStatus; label: string }[] = [
    { value: "all", label: "Все" },
    { value: "active", label: "Активные" },
    { value: "upcoming", label: "Скоро" },
    { value: "ended", label: "Завершённые" },
  ];

  const filtered = RAFFLES
    .filter((r) => statusFilter === "all" || r.status === statusFilter)
    .filter((r) => r.minAmount >= minAmount)
    .sort((a, b) => {
      if (sortBy === "date") return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
      if (sortBy === "amount") return a.minAmount - b.minAmount;
      if (sortBy === "participants") return b.participants - a.participants;
      return a.prize.localeCompare(b.prize);
    });

  return (
    <div>
      <div className="glass rounded-2xl p-5 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Статус</p>
            <div className="flex gap-2 flex-wrap">
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    statusFilter === opt.value
                      ? "grad-btn shadow-lg"
                      : "bg-secondary text-muted-foreground hover:text-white hover:bg-white/10"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Сортировка</p>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: "date", label: "По дате" },
                { value: "amount", label: "По взносу" },
                { value: "participants", label: "По участникам" },
                { value: "prize", label: "По призу" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSortBy(opt.value as "date" | "prize" | "amount" | "participants")}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    sortBy === opt.value
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                      : "bg-secondary text-muted-foreground hover:text-white hover:bg-white/10"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">
              Мин. взнос от: <span className="text-white">{minAmount} ₽</span>
            </p>
            <input
              type="range"
              min={0}
              max={2000}
              step={100}
              value={minAmount}
              onChange={(e) => setMinAmount(Number(e.target.value))}
              className="w-40 accent-purple-500 cursor-pointer"
            />
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Найдено: <span className="text-white font-medium">{filtered.length}</span> розыгрышей
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map((r, i) => (
          <RaffleCard key={r.id} raffle={r} idx={i} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-16 text-muted-foreground">
            <Icon name="SearchX" size={48} className="mx-auto mb-3 opacity-30" />
            <p>Розыгрыши не найдены</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CabinetSection() {
  const myRaffles = RAFFLES.filter((r) => r.status === "active").slice(0, 3);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="glass rounded-3xl p-6 mb-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-cyan-500/10 pointer-events-none" />
        <div className="flex items-center gap-5 relative">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl animate-float">
              😎
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full border-2 border-background" />
          </div>
          <div>
            <h2 className="font-oswald text-2xl font-bold text-white">Иван Петров</h2>
            <p className="text-muted-foreground text-sm mb-2">ivan.petrov@mail.ru</p>
            <span className="text-xs px-3 py-1 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-300 border border-yellow-500/30 font-medium">
              ⭐ Премиум участник
            </span>
          </div>
          <div className="ml-auto text-right hidden md:block">
            <p className="text-muted-foreground text-xs mb-1">Баланс</p>
            <p className="font-oswald text-3xl font-bold grad-text">12 450 ₽</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Участий", value: "47", icon: "Ticket", color: "from-purple-500 to-pink-500" },
          { label: "Побед", value: "3", icon: "Trophy", color: "from-yellow-500 to-orange-500" },
          { label: "Потрачено", value: "24 850 ₽", icon: "CreditCard", color: "from-cyan-500 to-blue-500" },
          { label: "Выиграно", value: "78 000 ₽", icon: "Banknote", color: "from-green-500 to-emerald-500" },
        ].map((s, i) => (
          <div
            key={s.label}
            className="card-glow rounded-2xl p-4 text-center opacity-0-init animate-fade-in-up"
            style={{ animationDelay: `${i * 0.1}s`, animationFillMode: "forwards" }}
          >
            <div className={`w-10 h-10 mx-auto mb-3 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center`}>
              <Icon name={s.icon as string} size={18} className="text-white" fallback="Star" />
            </div>
            <p className="font-oswald text-xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="card-glow rounded-2xl p-5">
        <h3 className="font-oswald text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Icon name="Zap" size={20} className="text-yellow-400" />
          Мои активные участия
        </h3>
        <div className="space-y-3">
          {myRaffles.map((r) => (
            <div key={r.id} className="glass rounded-xl p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${r.gradient} flex items-center justify-center shrink-0`}>
                <Icon name={r.prizeIcon as string} size={18} className="text-white" fallback="Gift" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm truncate">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.participants.toLocaleString("ru")} участников</p>
              </div>
              <div className="text-right shrink-0">
                <CountdownTimer endDate={r.endDate} />
              </div>
            </div>
          ))}
        </div>

        <button className="w-full mt-4 py-3 rounded-xl border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 transition-colors text-sm font-medium">
          Пополнить баланс
        </button>
      </div>
    </div>
  );
}

function HistorySection() {
  const [sortCol, setSortCol] = useState<string>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  type HistoryItem = typeof HISTORY[0];
  const sorted = [...HISTORY].sort((a: HistoryItem, b: HistoryItem) => {
    const av = a[sortCol as keyof HistoryItem];
    const bv = b[sortCol as keyof HistoryItem];
    if (typeof av === "string" && typeof bv === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const SortIcon = ({ col }: { col: string }) => (
    <Icon
      name={sortCol === col ? (sortDir === "asc" ? "ChevronUp" : "ChevronDown") : "ChevronsUpDown"}
      size={14}
      className={sortCol === col ? "text-purple-400" : "text-muted-foreground"}
    />
  );

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { label: "Всего участий", value: HISTORY.length, suffix: "", icon: "List", grad: "from-purple-500 to-pink-500" },
          { label: "Потрачено", value: HISTORY.reduce((s, h) => s + h.amount, 0).toLocaleString("ru"), suffix: " ₽", icon: "TrendingDown", grad: "from-orange-500 to-red-500" },
          { label: "Активных", value: HISTORY.filter(h => h.status === "Участвую").length, suffix: "", icon: "Activity", grad: "from-cyan-500 to-blue-500" },
        ].map((s, i) => (
          <div
            key={s.label}
            className="glass rounded-2xl p-5 flex items-center gap-4 opacity-0-init animate-fade-in-up"
            style={{ animationDelay: `${i * 0.1}s`, animationFillMode: "forwards" }}
          >
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${s.grad} flex items-center justify-center shrink-0`}>
              <Icon name={s.icon as string} size={20} className="text-white" fallback="Star" />
            </div>
            <div>
              <p className="font-oswald text-2xl font-bold text-white">{s.value}{s.suffix}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card-glow rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {[
                  { col: "raffle", label: "Розыгрыш" },
                  { col: "date", label: "Дата" },
                  { col: "amount", label: "Сумма" },
                  { col: "tickets", label: "Билетов" },
                  { col: "status", label: "Статус" },
                ].map(({ col, label }) => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className="px-5 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      {label}
                      <SortIcon col={col} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((item, i) => (
                <tr
                  key={item.id}
                  className="border-b border-white/5 hover:bg-white/3 transition-colors opacity-0-init animate-fade-in-up"
                  style={{ animationDelay: `${i * 0.05}s`, animationFillMode: "forwards" }}
                >
                  <td className="px-5 py-4 text-sm text-white font-medium">{item.raffle}</td>
                  <td className="px-5 py-4 text-sm text-muted-foreground">{item.date}</td>
                  <td className="px-5 py-4 text-sm font-bold text-white">{item.amount.toLocaleString("ru")} ₽</td>
                  <td className="px-5 py-4 text-sm text-muted-foreground">{item.tickets} шт.</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                      item.status === "Участвую"
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : "bg-slate-500/20 text-slate-400 border-slate-500/30"
                    }`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ContactsSection() {
  const [sent, setSent] = useState(false);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { icon: "Phone", label: "Телефон", value: "+7 (800) 555-35-35", color: "from-green-500 to-emerald-600" },
          { icon: "Mail", label: "Email", value: "support@raffle.ru", color: "from-purple-500 to-pink-600" },
          { icon: "MessageSquare", label: "Telegram", value: "@raffle_support", color: "from-cyan-500 to-blue-600" },
        ].map((c, i) => (
          <div
            key={c.label}
            className="card-glow rounded-2xl p-5 text-center opacity-0-init animate-fade-in-up"
            style={{ animationDelay: `${i * 0.1}s`, animationFillMode: "forwards" }}
          >
            <div className={`w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center`}>
              <Icon name={c.icon as string} size={20} className="text-white" fallback="Contact" />
            </div>
            <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider">{c.label}</p>
            <p className="text-white font-medium text-sm">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="card-glow rounded-2xl p-6">
        <h3 className="font-oswald text-2xl font-semibold text-white mb-5">Написать нам</h3>
        {sent ? (
          <div className="text-center py-10 animate-scale-in">
            <div className="text-6xl mb-4 animate-float inline-block">✅</div>
            <p className="font-oswald text-2xl font-bold text-white mb-2">Сообщение отправлено!</p>
            <p className="text-muted-foreground">Ответим в течение 2 часов</p>
            <button
              onClick={() => setSent(false)}
              className="mt-6 px-6 py-2 rounded-xl border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 transition-colors text-sm"
            >
              Написать ещё
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block font-medium uppercase tracking-wider">Имя</label>
                <input
                  type="text"
                  className="w-full glass rounded-xl px-4 py-3 text-white placeholder-muted-foreground focus:outline-none focus:border-purple-500/60 border border-transparent transition-colors bg-white/5 text-sm"
                  placeholder="Ваше имя"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block font-medium uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  className="w-full glass rounded-xl px-4 py-3 text-white placeholder-muted-foreground focus:outline-none focus:border-purple-500/60 border border-transparent transition-colors bg-white/5 text-sm"
                  placeholder="your@email.ru"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium uppercase tracking-wider">Сообщение</label>
              <textarea
                rows={4}
                className="w-full glass rounded-xl px-4 py-3 text-white placeholder-muted-foreground focus:outline-none focus:border-purple-500/60 border border-transparent transition-colors resize-none bg-white/5 text-sm"
                placeholder="Ваш вопрос или предложение..."
              />
            </div>
            <button type="submit" className="w-full grad-btn rounded-xl py-3.5 font-semibold font-golos">
              Отправить сообщение
            </button>
          </form>
        )}
      </div>

      <div className="mt-6 card-glow rounded-2xl p-6">
        <h3 className="font-oswald text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Icon name="HelpCircle" size={20} className="text-cyan-400" />
          Частые вопросы
        </h3>
        <div className="space-y-3">
          {[
            { q: "Как участвовать в розыгрыше?", a: "Выберите розыгрыш, оплатите участие и ждите результатов." },
            { q: "Когда объявляются победители?", a: "Победитель объявляется сразу после окончания розыгрыша." },
            { q: "Как получить приз?", a: "Мы свяжемся с победителем по email в течение 24 часов." },
          ].map((faq, i) => (
            <div key={i} className="glass rounded-xl p-4">
              <p className="text-white font-medium text-sm mb-1">❓ {faq.q}</p>
              <p className="text-muted-foreground text-sm">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type AuthMode = "login" | "register" | "forgot";

function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { setLoading(false); setDone(true); }, 1400);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" />

      {/* Modal */}
      <div className="relative w-full max-w-md animate-scale-in" style={{ animationFillMode: "forwards" }}>
        {/* Glow */}
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 rounded-3xl blur-lg opacity-40" />

        <div className="relative glass rounded-3xl overflow-hidden border border-white/10">
          {/* Top gradient bar */}
          <div className="h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400" />

          <div className="p-8">
            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-5 right-5 w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-white transition-colors"
            >
              <Icon name="X" size={16} />
            </button>

            {done ? (
              <div className="text-center py-6">
                <div className="text-6xl mb-4 animate-float inline-block">🎉</div>
                <h2 className="font-oswald text-3xl font-bold text-white mb-2">
                  {mode === "forgot" ? "Письмо отправлено!" : mode === "register" ? "Добро пожаловать!" : "С возвращением!"}
                </h2>
                <p className="text-muted-foreground text-sm mb-6">
                  {mode === "forgot"
                    ? "Проверь почту — там инструкция по восстановлению."
                    : "Теперь ты в игре. Удача на твоей стороне!"}
                </p>
                <button onClick={onClose} className="grad-btn rounded-xl px-8 py-3 font-semibold">
                  Вперёд!
                </button>
              </div>
            ) : (
              <>
                {/* Logo */}
                <div className="flex justify-center mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl animate-float">
                    🎰
                  </div>
                </div>

                {/* Tabs */}
                {mode !== "forgot" && (
                  <div className="flex bg-secondary rounded-2xl p-1 mb-6">
                    {(["login", "register"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMode(m)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                          mode === m
                            ? "grad-btn shadow-lg"
                            : "text-muted-foreground hover:text-white"
                        }`}
                      >
                        {m === "login" ? "Войти" : "Регистрация"}
                      </button>
                    ))}
                  </div>
                )}

                {mode === "forgot" && (
                  <div className="mb-6">
                    <button
                      onClick={() => setMode("login")}
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-white transition-colors mb-4"
                    >
                      <Icon name="ArrowLeft" size={14} />
                      Назад
                    </button>
                    <h2 className="font-oswald text-2xl font-bold text-white mb-1">Забыли пароль?</h2>
                    <p className="text-muted-foreground text-sm">Введите email — пришлём ссылку для сброса</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {mode === "register" && (
                    <div className="animate-fade-in-up" style={{ animationFillMode: "forwards" }}>
                      <label className="text-xs text-muted-foreground mb-1.5 block font-medium uppercase tracking-wider">Имя</label>
                      <div className="relative">
                        <Icon name="User" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          required
                          placeholder="Ваше имя"
                          className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl pl-10 pr-4 py-3 text-white placeholder-muted-foreground text-sm outline-none transition-colors"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block font-medium uppercase tracking-wider">Email</label>
                    <div className="relative">
                      <Icon name="Mail" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="email"
                        required
                        placeholder="your@email.ru"
                        className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl pl-10 pr-4 py-3 text-white placeholder-muted-foreground text-sm outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {mode !== "forgot" && (
                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block font-medium uppercase tracking-wider">Пароль</label>
                      <div className="relative">
                        <Icon name="Lock" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type={showPass ? "text" : "password"}
                          required
                          placeholder="••••••••"
                          className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl pl-10 pr-10 py-3 text-white placeholder-muted-foreground text-sm outline-none transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass(v => !v)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                        >
                          <Icon name={showPass ? "EyeOff" : "Eye"} size={16} />
                        </button>
                      </div>
                    </div>
                  )}

                  {mode === "register" && (
                    <div className="animate-fade-in-up" style={{ animationFillMode: "forwards" }}>
                      <label className="text-xs text-muted-foreground mb-1.5 block font-medium uppercase tracking-wider">Повторите пароль</label>
                      <div className="relative">
                        <Icon name="Lock" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type={showPass ? "text" : "password"}
                          required
                          placeholder="••••••••"
                          className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl pl-10 pr-4 py-3 text-white placeholder-muted-foreground text-sm outline-none transition-colors"
                        />
                      </div>
                    </div>
                  )}

                  {mode === "login" && (
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => setMode("forgot")}
                        className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        Забыли пароль?
                      </button>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full grad-btn rounded-xl py-3.5 font-bold font-golos flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Загрузка...
                      </>
                    ) : (
                      <>
                        <Icon name={mode === "forgot" ? "Send" : mode === "register" ? "UserPlus" : "LogIn"} size={16} />
                        {mode === "forgot" ? "Отправить письмо" : mode === "register" ? "Создать аккаунт" : "Войти"}
                      </>
                    )}
                  </button>

                  {/* Social */}
                  {mode !== "forgot" && (
                    <div>
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-white/10" />
                        <span className="text-xs text-muted-foreground">или войди через</span>
                        <div className="flex-1 h-px bg-white/10" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: "VK", icon: "Users", color: "hover:border-blue-500/40" },
                          { label: "Google", icon: "Globe", color: "hover:border-red-500/40" },
                        ].map((s) => (
                          <button
                            key={s.label}
                            type="button"
                            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/10 ${s.color} bg-white/3 hover:bg-white/5 text-muted-foreground hover:text-white transition-all text-sm font-medium`}
                          >
                            <Icon name={s.icon as string} size={15} fallback="Globe" />
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Index() {
  const [activeSection, setActiveSection] = useState<Section>("raffles");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const SECTION_COMPONENTS: Record<Section, JSX.Element> = {
    raffles: <RafflesSection />,
    cabinet: <CabinetSection />,
    history: <HistorySection />,
    contacts: <ContactsSection />,
  };

  const SECTION_TITLES: Record<Section, { title: string; subtitle: string }> = {
    raffles: { title: "Розыгрыши", subtitle: "Участвуй и выигрывай крутые призы" },
    cabinet: { title: "Личный кабинет", subtitle: "Управляй участиями и балансом" },
    history: { title: "История участий", subtitle: "Все твои ставки в одном месте" },
    contacts: { title: "Контакты", subtitle: "Мы всегда на связи" },
  };

  return (
    <div className="min-h-screen mesh-bg">
      {/* Ticker */}
      <div className="bg-gradient-to-r from-purple-900/60 via-pink-900/60 to-purple-900/60 border-b border-purple-500/20 py-2 overflow-hidden">
        <div className="flex gap-12 animate-ticker whitespace-nowrap">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i} className="text-sm text-purple-200 font-medium flex-shrink-0">
              {item}
              <span className="mx-6 text-purple-500">◆</span>
            </span>
          ))}
        </div>
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-50 glass border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveSection("raffles")}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center animate-pulse-glow">
              <span className="text-lg">🎰</span>
            </div>
            <div>
              <span className="font-oswald text-xl font-bold text-white tracking-wide">УДАЧА</span>
              <span className="font-oswald text-xl font-bold grad-text tracking-wide">.РФ</span>
            </div>
          </div>

          <nav className="hidden md:flex gap-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  activeSection === item.id
                    ? "grad-btn shadow-lg shadow-purple-500/20"
                    : "text-muted-foreground hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon name={item.icon as string} size={16} fallback="Circle" />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setAuthOpen(true)}
              className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl neon-border text-sm font-medium text-white hover:bg-white/5 transition-colors"
            >
              <Icon name="LogIn" size={16} />
              Войти
            </button>
            <button
              className="md:hidden p-2 text-muted-foreground hover:text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Icon name={mobileMenuOpen ? "X" : "Menu"} size={22} />
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/5 bg-background/95 backdrop-blur-xl">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => { setActiveSection(item.id); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-6 py-4 text-sm font-medium transition-colors ${
                  activeSection === item.id ? "text-purple-400 bg-purple-500/10" : "text-muted-foreground"
                }`}
              >
                <Icon name={item.icon as string} size={18} fallback="Circle" />
                {item.label}
              </button>
            ))}
            <button
              onClick={() => { setAuthOpen(true); setMobileMenuOpen(false); }}
              className="w-full flex items-center gap-3 px-6 py-4 text-sm font-medium text-purple-400 border-t border-white/5"
            >
              <Icon name="LogIn" size={18} />
              Войти / Регистрация
            </button>
          </div>
        )}
      </header>

      {/* Hero (only on raffles) */}
      {activeSection === "raffles" && (
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-pink-900/20 to-orange-900/20" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-20 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" />

          <div className="relative max-w-7xl mx-auto px-4 md:px-6 py-14 md:py-20">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass neon-border text-xs font-medium text-purple-300 mb-5 animate-fade-in-up">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {RAFFLES.filter(r => r.status === "active").length} активных розыгрыша прямо сейчас
              </div>

              <h1
                className="font-oswald text-5xl md:text-7xl font-bold leading-none mb-4 opacity-0-init animate-fade-in-up delay-100"
                style={{ animationFillMode: "forwards" }}
              >
                ТВОЙ ШАНС<br />
                <span className="grad-text">ИЗМЕНИТЬ</span><br />
                ВСЁ
              </h1>

              <p
                className="text-muted-foreground text-lg mb-8 opacity-0-init animate-fade-in-up delay-200"
                style={{ animationFillMode: "forwards" }}
              >
                Розыгрыши призов с честными правилами. Тысячи победителей ежемесячно.
              </p>

              <div
                className="flex flex-wrap gap-3 opacity-0-init animate-fade-in-up delay-300"
                style={{ animationFillMode: "forwards" }}
              >
                <button className="grad-btn rounded-2xl px-8 py-4 font-bold text-base font-golos flex items-center gap-2">
                  <Icon name="Zap" size={18} />
                  Участвовать сейчас
                </button>
                <button className="glass neon-border rounded-2xl px-8 py-4 font-semibold text-white text-base font-golos hover:bg-white/5 transition-colors">
                  Как это работает?
                </button>
              </div>

              <div
                className="flex flex-wrap gap-8 mt-10 opacity-0-init animate-fade-in-up delay-400"
                style={{ animationFillMode: "forwards" }}
              >
                {[
                  { value: "150 000+", label: "Участников" },
                  { value: "2 400+", label: "Победителей" },
                  { value: "850 млн ₽", label: "Призов роздано" },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="font-oswald text-2xl font-bold grad-text">{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        {activeSection !== "raffles" && (
          <div className="mb-8 opacity-0-init animate-fade-in-up" style={{ animationFillMode: "forwards" }}>
            <h2 className="font-oswald text-4xl font-bold text-white">
              {SECTION_TITLES[activeSection].title}
            </h2>
            <p className="text-muted-foreground mt-1">{SECTION_TITLES[activeSection].subtitle}</p>
          </div>
        )}

        {SECTION_COMPONENTS[activeSection]}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-oswald text-lg font-bold text-white">УДАЧА</span>
            <span className="font-oswald text-lg font-bold grad-text">.РФ</span>
          </div>
          <p className="text-xs text-muted-foreground">© 2026 УДАЧА.РФ — Все права защищены</p>
          <div className="flex gap-4">
            {["Правила", "Конфиденциальность", "Поддержка"].map(l => (
              <button key={l} className="text-xs text-muted-foreground hover:text-white transition-colors">
                {l}
              </button>
            ))}
          </div>
        </div>
      </footer>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  );
}