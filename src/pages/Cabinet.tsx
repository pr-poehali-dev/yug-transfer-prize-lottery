import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { CLIENT_CABINET_URL } from "@/components/admin/adminTypes";

const TOKEN_KEY = "client_token";
const SUPPORT_TG = "https://t.me/";

const TARIFFS = ["Срочный", "Стандарт", "Комфорт", "Минивэн", "Бизнес"];
const COUNTS = ["1", "2", "3", "4", "5", "6", "7", "8"];

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

type Tab = "dashboard" | "trips" | "new" | "bonus" | "payment" | "profile" | "settings";

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
const inputCls =
  "w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/40 text-sm outline-none focus:border-amber-500/60 transition-colors [color-scheme:dark]";

const NAV: { key: Tab; icon: string; label: string; soon?: boolean }[] = [
  { key: "dashboard", icon: "LayoutGrid", label: "Главная" },
  { key: "trips", icon: "MapPinned", label: "Мои поездки" },
  { key: "new", icon: "Plus", label: "Новый заказ" },
  { key: "bonus", icon: "Gift", label: "Бонусы и кэшбэк" },
  { key: "payment", icon: "CreditCard", label: "Способы оплаты", soon: true },
  { key: "profile", icon: "UserRound", label: "Профиль" },
  { key: "settings", icon: "Settings", label: "Настройки", soon: true },
];

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

/* ---------------- DASHBOARD ---------------- */
function DashboardTab({
  name, requests, activeCount, doneCount, points, onNew, onAllTrips,
}: {
  name: string;
  requests: ClientRequest[];
  activeCount: number;
  doneCount: number;
  points: number;
  onNew: () => void;
  onAllTrips: () => void;
}) {
  const stats = [
    { icon: "MapPinned", label: "Всего поездок", value: requests.length, color: "text-amber-400" },
    { icon: "Clock", label: "Активные", value: activeCount, color: "text-blue-400" },
    { icon: "CheckCheck", label: "Завершено", value: doneCount, color: "text-emerald-400" },
    { icon: "Gift", label: "Баллы", value: points, color: "text-amber-400" },
  ];
  const recent = requests.slice(0, 4);
  return (
    <div className="space-y-5">
      {/* greeting */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Здравствуйте, {name || "Клиент"}!</h1>
          <p className="text-white/50 text-sm mt-0.5">Добро пожаловать в личный кабинет</p>
        </div>
        <button
          onClick={onNew}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl px-4 py-2.5 transition-colors"
        >
          <Icon name="Plus" size={18} /> Новый заказ
        </button>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-[#161616] rounded-2xl border border-white/10 p-4">
            <Icon name={s.icon} size={22} className={`${s.color} mb-2`} />
            <div className="text-2xl font-bold text-white">{s.value}</div>
            <div className="text-white/50 text-sm">{s.label}</div>
          </div>
        ))}
      </div>

      {/* recent trips wide block */}
      <div className="bg-[#161616] rounded-2xl border border-white/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Последние поездки</h2>
          <button onClick={onAllTrips} className="text-amber-400 text-sm hover:text-amber-300 flex items-center gap-1">
            Все поездки <Icon name="ChevronRight" size={16} />
          </button>
        </div>
        {recent.length === 0 ? (
          <div className="text-center py-10">
            <Icon name="MapPinned" size={40} className="text-amber-400 mx-auto mb-2" />
            <div className="text-white/60">Поездок пока нет</div>
            <button onClick={onNew} className="mt-4 inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl px-4 py-2 transition-colors">
              <Icon name="Plus" size={16} /> Заказать
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {recent.map((req) => (
              <div key={req.id} className="flex items-center gap-4 py-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Icon name="MapPin" size={18} className="text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate">{req.from_city} → {req.to_city}</div>
                  <div className="text-white/40 text-xs">№{req.id} · {req.trip_date} {req.trip_time} · {req.tariff}</div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full border shrink-0 ${STATUS_STYLE[req.status] || "bg-white/10 text-white/70 border-white/20"}`}>
                  {req.status_label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- TRIPS TAB ---------------- */
function TripsTab({
  requests, activeOrders, onNew,
}: {
  requests: ClientRequest[];
  activeOrders: ClientRequest[];
  onNew: () => void;
}) {
  const [filter, setFilter] = useState<"active" | "all">("active");
  const list = filter === "active" ? activeOrders : requests;
  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Мои поездки</h1>
        <button
          onClick={onNew}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl px-4 py-2.5 transition-colors"
        >
          <Icon name="Plus" size={18} /> Новый заказ
        </button>
      </div>

      <div className="inline-flex bg-[#161616] border border-white/10 rounded-xl p-1 mb-5">
        {([
          { k: "active", label: `Активные (${activeOrders.length})` },
          { k: "all", label: `Все (${requests.length})` },
        ] as const).map((t) => (
          <button
            key={t.k}
            onClick={() => setFilter(t.k)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === t.k ? "bg-amber-500 text-black" : "text-white/60 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="bg-[#161616] rounded-2xl border border-white/10 p-12 text-center">
          <Icon name="MapPinned" size={46} className="text-amber-400 mx-auto mb-3" />
          <div className="text-white font-bold text-lg">
            {filter === "active" ? "Активных поездок нет" : "Поездок пока нет"}
          </div>
          <div className="text-white/50 text-sm mt-1">Оформите первый заказ — он появится здесь</div>
          <button
            onClick={onNew}
            className="mt-5 inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl px-5 py-2.5 transition-colors"
          >
            <Icon name="Plus" size={18} /> Заказать поездку
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {list.map((req) => (
            <div key={req.id} className="rounded-2xl border border-white/10 bg-[#161616] p-4 hover:border-amber-500/30 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-semibold">Заказ №{req.id}</span>
                <span className={`text-xs px-2.5 py-1 rounded-full border ${STATUS_STYLE[req.status] || "bg-white/10 text-white/70 border-white/20"}`}>
                  {req.status_label}
                </span>
              </div>
              <div className="flex items-start gap-2 text-white/90 text-sm mb-3">
                <Icon name="MapPin" size={16} className="text-amber-400 mt-0.5 shrink-0" />
                <span>{req.from_city} <span className="text-white/40">→</span> {req.to_city}</span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-white/50 text-xs">
                {(req.trip_date || req.trip_time) && <span>📅 {req.trip_date} {req.trip_time}</span>}
                {req.tariff && <span>🎫 {req.tariff}</span>}
                {req.people && <span>👤 {req.people}</span>}
                {req.baggage && <span>🧳 {req.baggage}</span>}
              </div>
              {req.comment && <div className="text-white/40 text-xs mt-2 border-t border-white/5 pt-2">💬 {req.comment}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- NEW ORDER TAB ---------------- */
function NewOrderTab({ token, onCreated }: { token: string; onCreated: () => void }) {
  const [form, setForm] = useState({
    trip_date: "", trip_time: "", from_city: "", to_city: "",
    people: "1", baggage: "1", tariff: "Срочный",
    child_seat: false, booster: false, animals: false, comment: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.from_city || !form.to_city) {
      setError("Укажите маршрут — откуда и куда");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${CLIENT_CABINET_URL}?action=create_request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Client-Token": token },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!d.ok) {
        setError(d.error || "Не удалось отправить заявку");
        return;
      }
      onCreated();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-5">Новый заказ</h1>
      <div className="bg-[#161616] rounded-2xl border border-white/10 p-5 md:p-6 max-w-2xl space-y-3">
        <input value={form.from_city} onChange={(e) => set("from_city", e.target.value)} placeholder="Откуда вас забрать?" className={inputCls} />
        <input value={form.to_city} onChange={(e) => set("to_city", e.target.value)} placeholder="Куда довезти?" className={inputCls} />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-white/70 text-xs font-medium mb-1">Дата поездки</label>
            <input value={form.trip_date} onChange={(e) => set("trip_date", e.target.value)} type="date" className={`${inputCls} ${!form.trip_date ? "text-white/40" : ""}`} />
          </div>
          <div>
            <label className="block text-white/70 text-xs font-medium mb-1">Время</label>
            <input value={form.trip_time} onChange={(e) => set("trip_time", e.target.value)} type="time" className={`${inputCls} ${!form.trip_time ? "text-white/40" : ""}`} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-white/70 text-xs font-medium mb-1">Кол-во человек</label>
            <select value={form.people} onChange={(e) => set("people", e.target.value)} className={inputCls}>
              {COUNTS.map((c) => <option key={c} value={c} className="bg-[#1a1a1a]">{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-white/70 text-xs font-medium mb-1">Кол-во багажа</label>
            <select value={form.baggage} onChange={(e) => set("baggage", e.target.value)} className={inputCls}>
              {["0", ...COUNTS].map((c) => <option key={c} value={c} className="bg-[#1a1a1a]">{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-white/70 text-xs font-medium mb-1">Выберите тариф</label>
          <select value={form.tariff} onChange={(e) => set("tariff", e.target.value)} className={inputCls}>
            {TARIFFS.map((t) => <option key={t} value={t} className="bg-[#1a1a1a]">{t}</option>)}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-1">
          {[
            { k: "child_seat", label: "Дет. кресло" },
            { k: "booster", label: "Бустер" },
            { k: "animals", label: "Животные" },
          ].map((c) => (
            <label key={c.k} className="flex items-center gap-2 text-white/90 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form[c.k as keyof typeof form] as boolean}
                onChange={(e) => set(c.k, e.target.checked)}
                className="w-4 h-4 accent-amber-500 shrink-0"
              />
              {c.label}
            </label>
          ))}
        </div>

        <textarea
          value={form.comment}
          onChange={(e) => set("comment", e.target.value)}
          placeholder="Комментарий (необязательно)"
          rows={2}
          className={`${inputCls} resize-y`}
        />

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-red-300 text-xs flex items-center gap-2">
            <Icon name="AlertCircle" size={14} />{error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold disabled:opacity-50 transition-colors"
        >
          {loading ? "Отправка..." : "Отправить заявку"}
        </button>
      </div>
    </div>
  );
}

/* ---------------- BONUS TAB ---------------- */
function BonusTab({ doneCount, points, phone }: { doneCount: number; points: number; phone: string }) {
  const promo = phone ? `MOY${phone.slice(-4)}` : "MOYTRANSFER";
  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-5">Бонусы и кэшбэк</h1>

      <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-3xl p-6 text-black max-w-2xl mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-black/70 text-sm font-medium">Ваш баланс баллов</div>
            <div className="text-4xl font-extrabold mt-1">{points}</div>
            <div className="text-black/60 text-sm mt-1">1 балл = 1 ₽ скидки</div>
          </div>
          <Icon name="Gift" size={56} className="text-black/80" />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 max-w-2xl">
        <div className="bg-[#161616] rounded-2xl border border-white/10 p-5">
          <Icon name="Percent" size={22} className="text-amber-400 mb-2" />
          <div className="text-white font-semibold">Кэшбэк 5%</div>
          <div className="text-white/50 text-sm mt-1">Возвращаем баллами с каждой поездки</div>
        </div>
        <div className="bg-[#161616] rounded-2xl border border-white/10 p-5">
          <Icon name="Award" size={22} className="text-amber-400 mb-2" />
          <div className="text-white font-semibold">{doneCount} поездок завершено</div>
          <div className="text-white/50 text-sm mt-1">Чем больше ездите — тем больше баллов</div>
        </div>
      </div>

      <div className="bg-[#161616] rounded-2xl border border-amber-500/20 p-5 max-w-2xl mt-3">
        <div className="text-white/60 text-sm mb-2">Ваш промокод для друзей</div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-amber-400 font-bold text-xl tracking-widest bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2">
            {promo}
          </div>
          <span className="text-white/50 text-sm">Друг получит скидку, а вы — 200 баллов</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- PROFILE TAB ---------------- */
function ProfileTab({ name, phone, onLogout }: { name: string; phone: string; onLogout: () => void }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-5">Профиль</h1>
      <div className="bg-[#161616] rounded-2xl border border-white/10 p-6 max-w-xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-amber-500/15 border-2 border-amber-500 flex items-center justify-center">
            <Icon name="UserRound" size={30} className="text-amber-400" />
          </div>
          <div>
            <div className="text-white font-bold text-xl">{name || "Клиент"}</div>
            <div className="text-white/50">{phone}</div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between border-t border-white/5 pt-3">
            <span className="text-white/50 text-sm flex items-center gap-2"><Icon name="User" size={16} className="text-amber-400" /> Имя</span>
            <span className="text-white">{name || "—"}</span>
          </div>
          <div className="flex items-center justify-between border-t border-white/5 pt-3">
            <span className="text-white/50 text-sm flex items-center gap-2"><Icon name="Phone" size={16} className="text-amber-400" /> Телефон</span>
            <span className="text-white">{phone}</span>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full mt-6 py-3.5 rounded-xl border-2 border-amber-500 text-amber-400 font-bold hover:bg-amber-500/10 transition-colors"
        >
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );
}

/* ---------------- STUB TAB ---------------- */
function StubTab({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-5">{title}</h1>
      <div className="bg-[#161616] rounded-2xl border border-white/10 p-12 text-center max-w-2xl">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-4">
          <Icon name={icon} size={30} className="text-amber-400" />
        </div>
        <div className="text-white font-bold text-lg">Раздел в разработке</div>
        <p className="text-white/50 text-sm mt-2 max-w-md mx-auto">{text}</p>
        <span className="inline-block mt-4 text-xs px-3 py-1 rounded-full bg-white/10 text-white/50">Скоро</span>
      </div>
    </div>
  );
}
