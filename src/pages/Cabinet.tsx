import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { CLIENT_CABINET_URL } from "@/components/admin/adminTypes";

const TOKEN_KEY = "client_token";
const SUPPORT_TG = "https://t.me/";

interface ClientRequest {
  id: number;
  from_city: string;
  to_city: string;
  trip_date: string;
  trip_time: string;
  people: string;
  baggage: string;
  tariff: string;
  child_seat: boolean;
  booster: boolean;
  animals: boolean;
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

const ACTIVE = ["new", "processing", "confirmed"];

const fieldCls =
  "w-full bg-black/40 border border-amber-500/20 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm outline-none focus:border-amber-500/60 transition-colors";

export default function Cabinet() {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [view, setView] = useState<"orders" | "history" | "profile">("orders");

  // auth form
  const [mode, setMode] = useState<"login" | "register">("login");
  const [fPhone, setFPhone] = useState("");
  const [fPass, setFPass] = useState("");
  const [fName, setFName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadRequests = useCallback(async (t: string) => {
    const r = await fetch(`${CLIENT_CABINET_URL}?action=requests`, {
      headers: { "X-Client-Token": t },
    });
    const d = await r.json();
    if (d.ok) setRequests(d.requests || []);
  }, []);

  const loadMe = useCallback(async (t: string) => {
    const r = await fetch(`${CLIENT_CABINET_URL}?action=me`, {
      headers: { "X-Client-Token": t },
    });
    const d = await r.json();
    if (d.ok) {
      setName(d.name || "");
      setPhone(d.phone || "");
    } else {
      localStorage.removeItem(TOKEN_KEY);
      setToken("");
    }
  }, []);

  useEffect(() => {
    if (token) {
      loadMe(token);
      loadRequests(token);
    }
  }, [token, loadMe, loadRequests]);

  const submitAuth = async () => {
    if (fPhone.replace(/\D/g, "").length < 11) {
      setError("Введите телефон в формате +7XXXXXXXXXX");
      return;
    }
    if (fPass.length < 4) {
      setError("Пароль должен быть не короче 4 символов");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const action = mode === "register" ? "register" : "login";
      const r = await fetch(`${CLIENT_CABINET_URL}?action=${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fPhone, password: fPass, name: fName }),
      });
      const d = await r.json();
      if (!d.ok) {
        setError(d.error || "Ошибка");
        return;
      }
      localStorage.setItem(TOKEN_KEY, d.token);
      setToken(d.token);
      setName(d.name || "");
      setPhone(d.phone || "");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setRequests([]);
    setView("orders");
  };

  const fmtPhone = (p: string) => {
    if (p.length !== 11) return p;
    return `+7 (${p.slice(1, 4)}) ${p.slice(4, 7)}-${p.slice(7, 9)}-${p.slice(9)}`;
  };

  // ---------- AUTH SCREEN ----------
  if (!token) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-7">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500 mb-4">
              <Icon name="UserRound" size={28} className="text-black" />
            </div>
            <h1 className="text-2xl font-bold text-white">Личный кабинет</h1>
            <p className="text-white/50 text-sm mt-1.5">
              {mode === "login" ? "Войдите по номеру и паролю" : "Создайте аккаунт"}
            </p>
          </div>

          <div className="bg-[#141414] rounded-3xl border border-amber-500/20 p-6 space-y-3">
            {mode === "register" && (
              <input value={fName} onChange={(e) => setFName(e.target.value)} placeholder="Как вас зовут" className={fieldCls} />
            )}
            <input value={fPhone} onChange={(e) => setFPhone(e.target.value)} placeholder="+7 (___) ___-__-__" type="tel" className={fieldCls} />
            <input value={fPass} onChange={(e) => setFPass(e.target.value)} placeholder="Пароль (придумайте)" type="password" className={fieldCls} />

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-red-300 text-xs flex items-center gap-2">
                <Icon name="AlertCircle" size={14} />{error}
              </div>
            )}

            <button
              onClick={submitAuth}
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold disabled:opacity-50 transition-colors"
            >
              {loading ? "Подождите..." : mode === "login" ? "Войти" : "Зарегистрироваться"}
            </button>

            <button
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
              className="w-full text-sm text-amber-400/80 hover:text-amber-400 pt-1"
            >
              {mode === "login" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
            </button>
          </div>

          <a href="/" className="mt-6 block text-center text-xs text-white/40 hover:text-white">← На главную</a>
        </div>
      </div>
    );
  }

  // ---------- CABINET SCREEN ----------
  const activeOrders = requests.filter((r) => ACTIVE.includes(r.status));
  const list = view === "history" ? requests : activeOrders;

  const renderOrder = (req: ClientRequest) => (
    <div key={req.id} className="rounded-2xl border border-white/10 bg-[#1c1c1c] p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-white font-semibold text-sm">Заказ №{req.id}</span>
        <span className={`text-xs px-2.5 py-1 rounded-full border ${STATUS_STYLE[req.status] || "bg-white/10 text-white/70 border-white/20"}`}>
          {req.status_label}
        </span>
      </div>
      <div className="flex items-center gap-2 text-white/90 text-sm">
        <Icon name="MapPin" size={14} className="text-amber-400" />
        {req.from_city} → {req.to_city}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-white/50 text-xs mt-2">
        {(req.trip_date || req.trip_time) && <span>📅 {req.trip_date} {req.trip_time}</span>}
        {req.tariff && <span>🎫 {req.tariff}</span>}
        {req.people && <span>👤 {req.people}</span>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black flex justify-center">
      <div className="w-full max-w-md px-4 py-6 pb-10">
        {/* Profile header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-amber-500/15 border-2 border-amber-500 flex items-center justify-center">
              <Icon name="UserRound" size={26} className="text-amber-400" />
            </div>
            <div>
              <div className="text-white font-bold text-lg leading-tight">{name || "Клиент"}</div>
              <div className="text-white/50 text-sm">{fmtPhone(phone)}</div>
            </div>
          </div>
          <button className="w-11 h-11 rounded-full border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Icon name="Bell" size={20} />
          </button>
        </div>

        {view === "profile" ? (
          <>
            <button onClick={() => setView("orders")} className="flex items-center gap-1.5 text-amber-400 text-sm mb-4">
              <Icon name="ArrowLeft" size={16} /> Назад
            </button>
            <h2 className="text-white font-bold text-lg mb-4">Профиль</h2>
            <div className="bg-[#1c1c1c] rounded-2xl border border-white/10 p-5 space-y-3">
              <div>
                <div className="text-white/40 text-xs">Имя</div>
                <div className="text-white">{name || "—"}</div>
              </div>
              <div>
                <div className="text-white/40 text-xs">Телефон</div>
                <div className="text-white">{fmtPhone(phone)}</div>
              </div>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-white font-bold text-lg mb-3">
              {view === "history" ? "История заказов" : "Мои заказы"}
            </h2>

            {list.length === 0 ? (
              <div className="bg-[#1c1c1c] rounded-2xl border border-white/10 p-8 text-center mb-4">
                <Icon name="Package" size={42} className="text-amber-400 mx-auto mb-3" />
                <div className="text-amber-400 font-bold text-lg">
                  {view === "history" ? "Заказов пока нет" : "Активных заказов нет"}
                </div>
                <div className="text-white/50 text-sm mt-1">Ваши заказы появятся здесь</div>
              </div>
            ) : (
              <div className="space-y-2.5 mb-4">{list.map(renderOrder)}</div>
            )}

            {view === "history" && (
              <button onClick={() => setView("orders")} className="flex items-center gap-1.5 text-amber-400 text-sm mb-4">
                <Icon name="ArrowLeft" size={16} /> К моим заказам
              </button>
            )}
          </>
        )}

        {/* Menu */}
        {view === "orders" && (
          <div className="space-y-2.5">
            <MenuItem icon="Plus" label="Новый заказ" onClick={() => navigate("/")} highlight />
            <MenuItem icon="History" label="История заказов" onClick={() => setView("history")} />
            <MenuItem icon="UserRound" label="Профиль" onClick={() => setView("profile")} />
            <MenuItem icon="CreditCard" label="Способы оплаты" onClick={() => {}} muted />
            <MenuItem icon="Headphones" label="Поддержка" onClick={() => window.open(SUPPORT_TG, "_blank")} />
          </div>
        )}

        <button
          onClick={logout}
          className="w-full mt-6 py-4 rounded-2xl border-2 border-amber-500 text-amber-400 font-bold hover:bg-amber-500/10 transition-colors"
        >
          Выйти
        </button>
      </div>
    </div>
  );
}

function MenuItem({
  icon, label, onClick, highlight, muted,
}: { icon: string; label: string; onClick: () => void; highlight?: boolean; muted?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3.5 bg-[#1c1c1c] rounded-2xl border border-white/10 px-5 py-4 hover:border-amber-500/40 transition-colors"
    >
      <span className={`w-9 h-9 rounded-full flex items-center justify-center ${highlight ? "bg-amber-500 text-black" : "text-amber-400"}`}>
        <Icon name={icon} size={20} />
      </span>
      <span className={`flex-1 text-left font-medium ${muted ? "text-white/50" : "text-white"}`}>{label}</span>
      <Icon name="ChevronRight" size={18} className="text-amber-400/60" />
    </button>
  );
}
