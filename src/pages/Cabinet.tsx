import { useState } from "react";
import Icon from "@/components/ui/icon";
import { CLIENT_CABINET_URL } from "@/components/admin/adminTypes";

interface ClientRequest {
  id: number;
  from_city: string;
  to_city: string;
  trip_date: string;
  trip_time: string;
  people: string;
  comment: string;
  status: string;
  status_label: string;
  created_at: string;
}

const STATUS_STYLE: Record<string, string> = {
  new: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  processing: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  confirmed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  done: "bg-teal-500/15 text-teal-300 border-teal-500/30",
  cancelled: "bg-red-500/15 text-red-300 border-red-500/30",
};

export default function Cabinet() {
  const [step, setStep] = useState<"phone" | "code" | "list">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [requests, setRequests] = useState<ClientRequest[]>([]);

  const sendCode = async () => {
    if (phone.replace(/\D/g, "").length < 11) {
      setError("Введите телефон в формате +7XXXXXXXXXX");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${CLIENT_CABINET_URL}?action=send_code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const d = await r.json();
      if (!d.ok) {
        setError(d.error || "Не удалось отправить код");
        return;
      }
      setStep("code");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!code.trim()) {
      setError("Введите код из SMS");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${CLIENT_CABINET_URL}?action=verify_code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const d = await r.json();
      if (!d.ok) {
        setError(d.error || "Неверный код");
        return;
      }
      await loadRequests();
      setStep("list");
    } finally {
      setLoading(false);
    }
  };

  const loadRequests = async () => {
    const r = await fetch(`${CLIENT_CABINET_URL}?action=requests&phone=${encodeURIComponent(phone)}`);
    const d = await r.json();
    if (d.ok) setRequests(d.requests || []);
  };

  const reset = () => {
    setStep("phone");
    setCode("");
    setError("");
    setRequests([]);
  };

  return (
    <div className="min-h-screen mesh-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 mb-4 shadow-lg">
            <Icon name="UserRound" size={26} className="text-white" />
          </div>
          <h1 className="font-oswald text-2xl md:text-3xl font-bold text-white">Личный кабинет</h1>
          <p className="text-muted-foreground text-sm mt-1.5">Отследите статус вашей заявки на трансфер</p>
        </div>

        <div className="glass rounded-3xl border border-white/10 p-6">
          {step === "phone" && (
            <div className="space-y-4">
              <label className="block text-sm text-white/70">Номер телефона из заявки</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 999 123-45-67"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500/50"
              />
              <button
                onClick={sendCode}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? "Отправка..." : (<><Icon name="MessageSquare" size={18} />Получить код в SMS</>)}
              </button>
            </div>
          )}

          {step === "code" && (
            <div className="space-y-4">
              <p className="text-sm text-white/70">Код отправлен на {phone}</p>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Код из SMS"
                inputMode="numeric"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-center text-lg tracking-widest outline-none focus:border-emerald-500/50"
              />
              <button
                onClick={verifyCode}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Проверка..." : "Войти"}
              </button>
              <button onClick={reset} className="w-full text-sm text-white/50 hover:text-white">
                Изменить номер
              </button>
            </div>
          )}

          {step === "list" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">Ваши заявки</span>
                <button onClick={loadRequests} className="text-white/50 hover:text-white">
                  <Icon name="RefreshCw" size={16} />
                </button>
              </div>
              {requests.length === 0 && (
                <div className="text-center py-8 text-white/40 text-sm">
                  По этому номеру заявок не найдено
                </div>
              )}
              {requests.map((req) => (
                <div key={req.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium text-sm">Заявка №{req.id}</span>
                    <span className={`text-xs px-2.5 py-1 rounded-full border ${STATUS_STYLE[req.status] || "bg-white/10 text-white/70 border-white/20"}`}>
                      {req.status_label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-white/90 text-sm">
                    <Icon name="MapPin" size={14} className="text-emerald-400" />
                    {req.from_city} → {req.to_city}
                  </div>
                  {(req.trip_date || req.trip_time) && (
                    <div className="flex items-center gap-2 text-white/60 text-xs mt-1.5">
                      <Icon name="Calendar" size={13} />
                      {req.trip_date} {req.trip_time}
                    </div>
                  )}
                </div>
              ))}
              <button onClick={reset} className="w-full text-sm text-white/50 hover:text-white pt-2">
                Выйти
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-red-300 text-xs flex items-center gap-2">
              <Icon name="AlertCircle" size={14} />
              {error}
            </div>
          )}
        </div>

        <a href="/" className="mt-6 block text-center text-xs text-muted-foreground hover:text-white transition-colors">
          ← На главную
        </a>
      </div>
    </div>
  );
}
