import { useState, useEffect, useCallback, useRef } from "react";
import Icon from "@/components/ui/icon";
import { Raffle } from "@/components/raffle-types";
import type { AppUser } from "@/pages/Index";
import { CABINET_URL } from "@/components/sections/cabinet/cabinet-types";
import { StatusBadge, CountdownTimer } from "./RaffleCountdownTimer";

const PAYMENT_URL = "https://functions.poehali.dev/81f8c74e-7d9c-47ff-8dfc-8f0e3dd7a155";

export function RaffleCard({ raffle, idx, user, onLoginRequired, onRefreshRaffles, onRefreshUser }: {
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
    }, 5000);
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
    } finally { setPaying(false); }
  };

  return (
    <div
      className="card-glow rounded-2xl overflow-hidden cursor-pointer opacity-0-init animate-fade-in-up"
      style={{ animationDelay: `${idx * 0.1}s`, animationFillMode: "forwards" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={`h-2 bg-gradient-to-r ${raffle.gradient}`} />

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