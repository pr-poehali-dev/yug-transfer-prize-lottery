import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { Raffle, RaffleStatus } from "@/components/raffle-types";
import type { AppUser } from "@/pages/Index";
import { CABINET_URL } from "@/components/sections/cabinet/cabinet-types";
import { RaffleCard } from "./raffle/RaffleCard";
import { WinnersSection } from "./raffle/RaffleWinners";
import { CountdownTimer } from "./raffle/RaffleCountdownTimer";

export { CountdownTimer };

const RAFFLES_URL = "https://functions.poehali.dev/39a7b356-ef83-46dd-81a0-581903229de9";

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

  useEffect(() => {
    fetchRaffles();
    const interval = setInterval(fetchRaffles, 30000);
    return () => clearInterval(interval);
  }, [fetchRaffles]);

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

  const statusPriority: Record<string, number> = { active: 0, upcoming: 1, ended: 2 };

  const filtered = rawRaffles
    .filter((r) => statusFilter === "all" || r.status === statusFilter)
    .filter((r) => r.minAmount >= minAmount)
    .sort((a, b) => {
      const pa = statusPriority[a.status] ?? 1;
      const pb = statusPriority[b.status] ?? 1;
      if (pa !== pb) return pa - pb;
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

      <WinnersSection raffles={rawRaffles} />
    </div>
  );
}