import { useState, useEffect, useCallback, useRef } from "react";
import Icon from "@/components/ui/icon";
import { Raffle, RaffleStatus } from "@/components/raffle-types";
import type { AppUser } from "@/pages/Index";
import { CABINET_URL } from "@/components/sections/cabinet/cabinet-types";

const RAFFLES_URL = "https://functions.poehali.dev/39a7b356-ef83-46dd-81a0-581903229de9";
const PAYMENT_URL = "https://functions.poehali.dev/81f8c74e-7d9c-47ff-8dfc-8f0e3dd7a155";

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

function RaffleCard({ raffle, idx, user, onLoginRequired, onRefreshRaffles, onRefreshUser }: {
  raffle: Raffle; idx: number;
  user: AppUser | null;
  onLoginRequired: () => void;
  onGoToCabinet: () => void;
  onRefreshRaffles: () => void;
  onRefreshUser: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [confirmUrl, setConfirmUrl] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [myTickets, setMyTickets] = useState<number>(0);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "waiting" | "success" | "failed">("idle");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  }, []);

  const loadMyTickets = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${CABINET_URL}?tickets&raffle_id=${raffle.id}`, {
        headers: { "X-User-Id": String(user.id) },
      });
      const data = await res.json();
      if (data.ok) setMyTickets(data.tickets);
    } catch { /* ignore */ }
  }, [user, raffle.id]);

  useEffect(() => { loadMyTickets(); }, [loadMyTickets]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.raffleId === raffle.id) loadMyTickets();
    };
    window.addEventListener("payment:success", handler);
    return () => window.removeEventListener("payment:success", handler);
  }, [raffle.id, loadMyTickets]);

  // Очищаем polling при размонтировании
  useEffect(() => () => { stopPolling(); }, [stopPolling]);

  const startPolling = useCallback((pid: string) => {
    setPaymentStatus("waiting");
    let attempts = 0;
    pollingRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`${PAYMENT_URL}?action=check&payment_id=${pid}`);
        const data = await res.json();
        if (data.status === "succeeded") {
          stopPolling();
          setPaymentStatus("success");
          setConfirmUrl("");
          // Обновляем всё
          await loadMyTickets();
          onRefreshRaffles();
          onRefreshUser();
          window.dispatchEvent(new CustomEvent("payment:success", { detail: { raffleId: raffle.id } }));
          setTimeout(() => setPaymentStatus("idle"), 4000);
        } else if (data.status === "canceled" || attempts >= 60) {
          stopPolling();
          setPaymentStatus("failed");
          setTimeout(() => setPaymentStatus("idle"), 4000);
        }
      } catch { /* ignore */ }
    }, 3000);
  }, [loadMyTickets, onRefreshRaffles, onRefreshUser, raffle.id, stopPolling]);

  const handleParticipate = async () => {
    if (!user) { onLoginRequired(); return; }
    if (raffle.status === "upcoming") return;
    setPaying(true); setError("");
    try {
      const res = await fetch(`${PAYMENT_URL}?action=create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": String(user.id) },
        body: JSON.stringify({
          raffle_id: raffle.id,
          raffle_title: raffle.title,
          amount: raffle.minAmount,
          return_url: `${window.location.origin}?payment=check`,
        }),
      });
      const data = await res.json();
      if (data.ok && data.confirmation_url) {
        setConfirmUrl(data.confirmation_url);
        setPaymentId(data.payment_id || "");
      } else {
        setError(data.error || "Ошибка оплаты");
      }
    } catch {
      setError("Нет соединения");
    }
    finally { setPaying(false); }
  };

  return (
    <div
      className="card-glow rounded-2xl overflow-hidden cursor-pointer opacity-0-init animate-fade-in-up"
      style={{ animationDelay: `${idx * 0.1}s`, animationFillMode: "forwards" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={`h-2 bg-gradient-to-r ${raffle.gradient}`} />

      {/* Фото розыгрыша */}
      {raffle.photoUrl && (
        <div className="relative overflow-hidden" style={{ height: 180 }}>
          <img
            src={raffle.photoUrl}
            alt={raffle.title}
            className={`w-full h-full object-cover transition-transform duration-500 ${hovered ? "scale-105" : "scale-100"}`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute top-3 right-3">
            <StatusBadge status={raffle.status} />
          </div>
        </div>
      )}

      <div className="p-5">
        {!raffle.photoUrl && (
          <div className="flex justify-between items-start mb-4">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${raffle.gradient} flex items-center justify-center transition-transform duration-300 ${hovered ? "scale-110 rotate-3" : ""}`}>
              <Icon name={raffle.prizeIcon as string} size={22} className="text-white" fallback="Gift" />
            </div>
            <StatusBadge status={raffle.status} />
          </div>
        )}
        {raffle.photoUrl && <div className="mb-3" />}

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

        {myTickets > 0 && raffle.status === "active" && (
          <div className="mb-3 flex items-center justify-between px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <div className="flex items-center gap-2">
              <Icon name="Ticket" size={15} className="text-purple-400" />
              <span className="text-sm text-purple-300 font-medium">
                У тебя {myTickets} билет{myTickets === 1 ? "" : myTickets < 5 ? "а" : "ов"}
              </span>
            </div>
            <span className="text-xs text-purple-400/70">Купи ещё ↓</span>
          </div>
        )}

        {error && <p className="text-red-400 text-xs text-center mb-2">{error}</p>}
        {raffle.status !== "ended" && (
          <button
            onClick={handleParticipate}
            disabled={paying}
            className="w-full grad-btn rounded-xl py-2.5 font-semibold text-sm font-golos flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {paying ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Создаём платёж...</>
            ) : raffle.status === "upcoming" ? (
              <><Icon name="Bell" size={15} />Напомнить мне</>
            ) : user && myTickets > 0 ? (
              <><Icon name="Plus" size={15} />Купить ещё билет — {raffle.minAmount.toLocaleString("ru")} ₽</>
            ) : user ? (
              <><Icon name="CreditCard" size={15} />Участвовать — {raffle.minAmount.toLocaleString("ru")} ₽</>
            ) : (
              <><Icon name="LogIn" size={15} />Войти и участвовать</>
            )}
          </button>
        )}

        {paymentStatus === "success" && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-[2px]">
            <div className="w-full max-w-sm bg-[#1a1025] rounded-3xl p-8 flex flex-col items-center gap-4 border border-emerald-500/30 shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-3xl">✅</div>
              <div className="text-center">
                <p className="text-white font-bold text-xl mb-1">Оплата прошла!</p>
                <p className="text-emerald-400 text-sm">Ты участвуешь в розыгрыше</p>
              </div>
            </div>
          </div>
        )}

        {confirmUrl && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-[2px]">
            <div className="w-full max-w-sm bg-[#1a1025] rounded-3xl p-8 flex flex-col items-center gap-6 border border-white/10 shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl">💳</div>
              <div className="text-center">
                <p className="text-white font-bold text-xl mb-1">Оплата готова</p>
                <p className="text-muted-foreground text-sm">Нажми кнопку ниже для перехода к оплате</p>
                <p className="text-white font-bold text-2xl mt-3">{raffle.minAmount.toLocaleString("ru")} ₽</p>
              </div>

              {paymentStatus === "waiting" ? (
                <div className="w-full flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2 text-purple-300 text-sm">
                    <div className="w-4 h-4 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
                    Ожидаем подтверждения оплаты...
                  </div>
                  <p className="text-xs text-white/30 text-center">Страница обновится автоматически</p>
                </div>
              ) : (
                <a
                  href={confirmUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => { if (paymentId) startPolling(paymentId); }}
                  className="w-full grad-btn rounded-2xl py-4 font-bold text-lg font-golos flex items-center justify-center gap-2 text-white text-center no-underline"
                >
                  🔐 Перейти к оплате
                </a>
              )}

              {paymentStatus !== "waiting" && (
                <button
                  onClick={() => { stopPolling(); setConfirmUrl(""); setPaymentStatus("idle"); }}
                  className="text-muted-foreground text-sm hover:text-white transition-colors"
                >
                  Отмена
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── RafflesSection ──────────────────────────────────────────────────────────

export function RafflesSection({ user, onLoginRequired, onGoToCabinet, onUserUpdate }: {
  user?: AppUser | null;
  onLoginRequired?: () => void;
  onGoToCabinet?: () => void;
  onUserUpdate?: (u: AppUser) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<RaffleStatus>("all");
  const [sortBy, setSortBy] = useState<"date" | "prize" | "amount" | "participants">("date");
  const [minAmount, setMinAmount] = useState(0);
  const [rawRaffles, setRawRaffles] = useState<Raffle[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const fetchRaffles = useCallback(() => {
    fetch(RAFFLES_URL)
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setRawRaffles(data.raffles.map((r: {
            id: number; title: string; prize: string; prize_icon: string;
            end_date: string; participants: number; min_amount: number;
            status: "active" | "ended" | "upcoming"; gradient: string; winner?: string; photo_url?: string;
          }) => ({
            id: r.id, title: r.title, prize: r.prize,
            prizeIcon: r.prize_icon, endDate: r.end_date,
            participants: r.participants, minAmount: r.min_amount,
            status: r.status, gradient: r.gradient, winner: r.winner,
            photoUrl: r.photo_url,
          })));
        }
      })
      .finally(() => setLoadingList(false));
  }, []);

  useEffect(() => { fetchRaffles(); }, [fetchRaffles]);

  const refreshUser = useCallback(async () => {
    if (!user || !onUserUpdate) return;
    try {
      const res = await fetch(`${CABINET_URL}`, { headers: { "X-User-Id": String(user.id) } });
      const data = await res.json();
      if (data.ok && data.user) {
        localStorage.setItem("app_user", JSON.stringify(data.user));
        onUserUpdate(data.user);
      }
    } catch { /* ignore */ }
  }, [user, onUserUpdate]);

  const statusOptions: { value: RaffleStatus; label: string }[] = [
    { value: "all", label: "Все" },
    { value: "active", label: "Активные" },
    { value: "upcoming", label: "Скоро" },
    { value: "ended", label: "Завершённые" },
  ];

  const filtered = rawRaffles
    .filter((r) => statusFilter === "all" || r.status === statusFilter)
    .filter((r) => r.minAmount >= minAmount)
    .sort((a, b) => {
      if (sortBy === "date") return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
      if (sortBy === "amount") return a.minAmount - b.minAmount;
      if (sortBy === "participants") return b.participants - a.participants;
      return a.prize.localeCompare(b.prize);
    });

  const hasActiveFilters = statusFilter !== "all" || sortBy !== "date" || minAmount > 0;

  return (
    <div>
      {/* Компактная строка фильтров */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setFiltersOpen(v => !v)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
            filtersOpen || hasActiveFilters
              ? "grad-btn border-transparent"
              : "glass border-white/10 text-muted-foreground hover:text-white"
          }`}
        >
          <Icon name="SlidersHorizontal" size={15} />
          Фильтры
          {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
        </button>

        {/* Активные фильтры — быстрые пилюли */}
        <div className="flex gap-1.5 flex-wrap">
          {statusFilter !== "all" && (
            <button onClick={() => setStatusFilter("all")}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              {statusOptions.find(o => o.value === statusFilter)?.label}
              <Icon name="X" size={11} />
            </button>
          )}
          {sortBy !== "date" && (
            <button onClick={() => setSortBy("date")}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              {sortBy === "amount" ? "По взносу" : sortBy === "participants" ? "По участникам" : "По призу"}
              <Icon name="X" size={11} />
            </button>
          )}
          {minAmount > 0 && (
            <button onClick={() => setMinAmount(0)}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              от {minAmount} ₽
              <Icon name="X" size={11} />
            </button>
          )}
        </div>

        <span className="ml-auto text-xs text-muted-foreground shrink-0">
          {filtered.length} розыгрышей
        </span>
      </div>

      {/* Раскрывающаяся панель */}
      {filtersOpen && (
        <div className="glass rounded-2xl p-4 mb-4 animate-fade-in-up" style={{ animationFillMode: "forwards" }}>
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Статус</p>
              <div className="flex gap-2 flex-wrap">
                {statusOptions.map((opt) => (
                  <button key={opt.value} onClick={() => setStatusFilter(opt.value)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                      statusFilter === opt.value ? "grad-btn" : "bg-secondary text-muted-foreground hover:text-white"
                    }`}>
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
                  <button key={opt.value} onClick={() => setSortBy(opt.value as "date" | "prize" | "amount" | "participants")}
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                      sortBy === opt.value ? "bg-purple-500/20 text-purple-300 border border-purple-500/40" : "bg-secondary text-muted-foreground hover:text-white"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">
                Мин. взнос от: <span className="text-white">{minAmount} ₽</span>
              </p>
              <input type="range" min={0} max={2000} step={100} value={minAmount}
                onChange={(e) => setMinAmount(Number(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer" />
            </div>
          </div>
        </div>
      )}

      {loadingList ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((r, i) => (
            <RaffleCard key={r.id} raffle={r} idx={i} user={user ?? null} onLoginRequired={onLoginRequired ?? (() => {})} onGoToCabinet={onGoToCabinet ?? (() => {})} onRefreshRaffles={fetchRaffles} onRefreshUser={refreshUser} />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-3 text-center py-16 text-muted-foreground">
              <Icon name="SearchX" size={48} className="mx-auto mb-3 opacity-30" />
              <p>Розыгрыши не найдены</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}