import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { CLIENT_CABINET_URL } from "@/components/admin/adminTypes";
import {
  TOKEN_KEY, ClientRequest, Tab, ACTIVE, fieldCls,
} from "@/components/cabinet/cabinetShared";
import CabinetHome from "@/components/cabinet/CabinetHome";
import CabinetDesktop from "@/components/cabinet/CabinetDesktop";
import TripsTab from "@/components/cabinet/CabinetTrips";
import { NewOrderTab, BonusTab, ProfileTab, StubTab } from "@/components/cabinet/CabinetForms";

export default function Cabinet() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState("");
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
      setAvatar(d.avatar_url || "");
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
      setAvatar(d.avatar_url || "");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setRequests([]);
    setAvatar("");
    setTab("dashboard");
  };

  const uploadAvatar = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) { alert("Файл больше 5 МБ"); return; }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const r = await fetch(`${CLIENT_CABINET_URL}?action=set_avatar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Client-Token": token },
      body: JSON.stringify({ image: dataUrl, ext }),
    });
    const d = await r.json();
    if (d.ok) setAvatar(d.avatar_url || "");
    else alert(d.error || "Не удалось загрузить фото");
  }, [token]);

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

  // ---------- CABINET ----------
  const activeOrders = requests.filter((r) => ACTIVE.includes(r.status));
  const doneCount = requests.filter((r) => r.status === "done").length;
  const points = doneCount * 100;

  const goNew = () => setTab("new");

  // HOME = mobile dashboard from design
  if (tab === "dashboard") {
    return (
      <div className="min-h-screen bg-[#0d0d0d] text-white">
        {/* Mobile / tablet dashboard */}
        <div className="lg:hidden">
          <CabinetHome
            name={name || "Клиент"}
            phone={fmtPhone(phone)}
            avatar={avatar}
            onUploadAvatar={uploadAvatar}
            activeCount={activeOrders.length}
            doneCount={doneCount}
            onNew={goNew}
            onTrips={() => setTab("trips")}
            onReview={() => setTab("review")}
            onProfile={() => setTab("profile")}
            onLogout={logout}
          />
        </div>
        {/* Desktop dashboard */}
        <div className="hidden lg:block">
          <CabinetDesktop
            name={name || "Клиент"}
            phone={fmtPhone(phone)}
            avatar={avatar}
            onUploadAvatar={uploadAvatar}
            requests={requests}
            activeOrders={activeOrders}
            doneCount={doneCount}
            onNew={goNew}
            onTrips={() => setTab("trips")}
            onReview={() => setTab("review")}
            onLogout={logout}
          />
        </div>
      </div>
    );
  }

  const SUBTITLE: Record<string, string> = {
    trips: "Мои поездки",
    new: "Новый заказ",
    review: "Оставить отзыв",
    profile: "Профиль",
    bonus: "Бонусы",
    payment: "Способы оплаты",
    settings: "Настройки",
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      <div className="mx-auto w-full max-w-md px-4 py-4">
        <button
          onClick={() => setTab("dashboard")}
          className="flex items-center gap-2 text-amber-400 font-semibold mb-4"
        >
          <Icon name="ChevronLeft" size={20} /> {SUBTITLE[tab] || "Назад"}
        </button>
        {tab === "trips" && <TripsTab requests={requests} activeOrders={activeOrders} onNew={goNew} />}
        {tab === "new" && (
          <NewOrderTab token={token} onCreated={() => { loadRequests(token); setTab("trips"); }} />
        )}
        {tab === "bonus" && <BonusTab doneCount={doneCount} points={points} phone={phone} />}
        {tab === "payment" && <StubTab icon="CreditCard" title="Способы оплаты" text="Скоро здесь можно будет привязать карту и оплачивать поездки онлайн." />}
        {tab === "review" && <StubTab icon="MessageSquare" title="Оставить отзыв" text="Скоро вы сможете оценить поездку и оставить отзыв о водителе прямо здесь." />}
        {tab === "settings" && <StubTab icon="Settings" title="Настройки" text="Скоро добавим уведомления, смену пароля и другие настройки аккаунта." />}
        {tab === "profile" && <ProfileTab name={name} phone={fmtPhone(phone)} onLogout={logout} />}
      </div>
    </div>
  );
}