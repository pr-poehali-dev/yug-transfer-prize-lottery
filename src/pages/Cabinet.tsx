import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { CLIENT_CABINET_URL } from "@/components/admin/adminTypes";
import {
  TOKEN_KEY, SUPPORT_TG, ClientRequest, Tab, ACTIVE, fieldCls, NAV,
} from "@/components/cabinet/cabinetShared";
import DashboardTab from "@/components/cabinet/CabinetDashboard";
import TripsTab from "@/components/cabinet/CabinetTrips";
import { NewOrderTab, BonusTab, ProfileTab, StubTab } from "@/components/cabinet/CabinetForms";

export default function Cabinet() {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [tab, setTab] = useState<Tab>("dashboard");

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
    setTab("dashboard");
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

          <div className="mt-6 flex items-center justify-center gap-4 text-xs">
            <a href="/" className="text-white/40 hover:text-white">← На главную</a>
            <span className="text-white/20">•</span>
            <a href="/admin" className="text-white/40 hover:text-amber-400 inline-flex items-center gap-1">
              <Icon name="LogIn" size={12} /> Админ-панель
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ---------- CABINET (DESKTOP) ----------
  const activeOrders = requests.filter((r) => ACTIVE.includes(r.status));
  const doneCount = requests.filter((r) => r.status === "done").length;
  const points = doneCount * 100;

  const goNew = () => setTab("new");

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      <div className="mx-auto max-w-[1400px] flex flex-col lg:flex-row gap-5 px-4 lg:px-6 py-5 lg:py-7">

        {/* SIDEBAR */}
        <aside className="lg:w-72 lg:shrink-0 lg:sticky lg:top-7 lg:self-start space-y-4">
          {/* profile card */}
          <div className="bg-gradient-to-br from-[#241a10] to-[#161616] rounded-3xl border border-amber-500/20 p-5">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-full bg-amber-500/15 border-2 border-amber-500 flex items-center justify-center shrink-0">
                <Icon name="UserRound" size={26} className="text-amber-400" />
              </div>
              <div className="min-w-0">
                <div className="text-white font-bold text-lg leading-tight truncate">{name || "Клиент"}</div>
                <div className="text-white/50 text-sm truncate">{fmtPhone(phone)}</div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between bg-black/30 rounded-2xl px-4 py-2.5 border border-amber-500/10">
              <span className="text-white/60 text-sm flex items-center gap-1.5"><Icon name="Gift" size={15} className="text-amber-400" /> Баллы</span>
              <span className="text-amber-400 font-bold">{points}</span>
            </div>
          </div>

          {/* nav */}
          <nav className="bg-[#161616] rounded-3xl border border-white/10 p-2.5 space-y-1">
            {NAV.map((item) => {
              const isActive = tab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setTab(item.key)}
                  className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors ${
                    isActive ? "bg-amber-500 text-black font-semibold" : "text-white/80 hover:bg-white/5"
                  }`}
                >
                  <Icon name={item.icon} size={20} className={isActive ? "text-black" : "text-amber-400"} />
                  <span className="flex-1">{item.label}</span>
                  {item.key === "trips" && activeOrders.length > 0 && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${isActive ? "bg-black/20 text-black" : "bg-amber-500/20 text-amber-400"}`}>
                      {activeOrders.length}
                    </span>
                  )}
                  {item.soon && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? "bg-black/20 text-black" : "bg-white/10 text-white/40"}`}>
                      скоро
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* footer actions */}
          <div className="bg-[#161616] rounded-3xl border border-white/10 p-2.5 space-y-1">
            <button
              onClick={() => window.open(SUPPORT_TG, "_blank")}
              className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-white/80 hover:bg-white/5 transition-colors"
            >
              <Icon name="Headphones" size={20} className="text-amber-400" />
              <span>Поддержка</span>
            </button>
            <button
              onClick={() => navigate("/")}
              className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-white/80 hover:bg-white/5 transition-colors"
            >
              <Icon name="Home" size={20} className="text-amber-400" />
              <span>На главную</span>
            </button>
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Icon name="LogOut" size={20} />
              <span>Выйти</span>
            </button>
          </div>
        </aside>

        {/* CONTENT */}
        <main className="flex-1 min-w-0">
          {tab === "dashboard" && (
            <DashboardTab
              name={name}
              requests={requests}
              activeCount={activeOrders.length}
              doneCount={doneCount}
              points={points}
              onNew={goNew}
              onAllTrips={() => setTab("trips")}
            />
          )}
          {tab === "trips" && (
            <TripsTab requests={requests} activeOrders={activeOrders} onNew={goNew} />
          )}
          {tab === "new" && (
            <NewOrderTab
              token={token}
              onCreated={() => { loadRequests(token); setTab("trips"); }}
            />
          )}
          {tab === "bonus" && <BonusTab doneCount={doneCount} points={points} phone={phone} />}
          {tab === "payment" && <StubTab icon="CreditCard" title="Способы оплаты" text="Скоро здесь можно будет привязать карту и оплачивать поездки онлайн." />}
          {tab === "settings" && <StubTab icon="Settings" title="Настройки" text="Скоро добавим уведомления, смену пароля и другие настройки аккаунта." />}
          {tab === "profile" && <ProfileTab name={name} phone={fmtPhone(phone)} onLogout={logout} />}
        </main>
      </div>
    </div>
  );
}
