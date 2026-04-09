import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { RAFFLES, HISTORY, Raffle, RaffleStatus } from "@/components/raffle-types";

// ─── StatusBadge ────────────────────────────────────────────────────────────

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

// ─── CountdownTimer ──────────────────────────────────────────────────────────

export function CountdownTimer({ endDate }: { endDate: string }) {
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

// ─── RaffleCard ──────────────────────────────────────────────────────────────

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

// ─── RafflesSection ──────────────────────────────────────────────────────────

export function RafflesSection() {
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

// ─── CabinetSection ──────────────────────────────────────────────────────────

export function CabinetSection() {
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

// ─── HistorySection ──────────────────────────────────────────────────────────

export function HistorySection() {
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

// ─── ContactsSection ─────────────────────────────────────────────────────────

export function ContactsSection() {
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
