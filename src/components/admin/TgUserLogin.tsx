import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { TG_USER_AUTH_URL } from "./adminTypes";

interface Props { token: string; }

interface Status {
  logged_in: boolean;
  phone: string | null;
  user: { id: number; username: string; first_name: string } | null;
}

export function TgUserLogin({ token }: Props) {
  const [status, setStatus] = useState<Status | null>(null);
  const [step, setStep] = useState<"idle" | "code" | "2fa">("idle");
  const [expanded, setExpanded] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const headers = { "Content-Type": "application/json", "X-Admin-Token": token };

  const loadStatus = async () => {
    const r = await fetch(TG_USER_AUTH_URL, { headers: { "X-Admin-Token": token } });
    setStatus(await r.json());
  };

  useEffect(() => { loadStatus(); }, []);

  const sendCode = async () => {
    if (!phone.trim()) { setError("Введи номер телефона"); return; }
    setLoading(true); setError("");
    try {
      const r = await fetch(`${TG_USER_AUTH_URL}?action=send_code`, {
        method: "POST", headers, body: JSON.stringify({ phone }),
      });
      const d = await r.json();
      if (!d.ok) { setError(d.error || "Ошибка"); return; }
      setStep("code");
    } finally { setLoading(false); }
  };

  const verifyCode = async () => {
    if (!code.trim()) { setError("Введи код из SMS"); return; }
    setLoading(true); setError("");
    try {
      const r = await fetch(`${TG_USER_AUTH_URL}?action=verify_code`, {
        method: "POST", headers, body: JSON.stringify({ code }),
      });
      const d = await r.json();
      if (d.need_2fa) { setStep("2fa"); return; }
      if (!d.ok) { setError(d.error || "Ошибка"); return; }
      setStep("idle"); setCode(""); setPhone("");
      await loadStatus();
    } finally { setLoading(false); }
  };

  const verify2fa = async () => {
    if (!password) { setError("Введи облачный пароль"); return; }
    setLoading(true); setError("");
    try {
      const r = await fetch(`${TG_USER_AUTH_URL}?action=verify_2fa`, {
        method: "POST", headers, body: JSON.stringify({ password }),
      });
      const d = await r.json();
      if (!d.ok) { setError(d.error || "Ошибка"); return; }
      setStep("idle"); setPassword(""); setCode(""); setPhone("");
      await loadStatus();
    } finally { setLoading(false); }
  };

  const logout = async () => {
    if (!confirm("Выйти из Telegram?")) return;
    await fetch(`${TG_USER_AUTH_URL}?action=logout`, { method: "POST", headers });
    await loadStatus();
  };

  if (!status) return null;

  return (
    <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: "rgba(255,255,255,0.02)" }}>
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 p-4 hover:bg-white/5 transition-colors text-left"
      >
        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
          <Icon name={status.logged_in ? "UserCheck" : "User"} size={20} className={status.logged_in ? "text-emerald-400" : "text-cyan-400"} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium text-lg">Telegram-аккаунт для сторис</h3>
          <p className="text-white/40 text-xs truncate">
            {status.logged_in
              ? `Залогинен: ${status.user?.first_name || ""} ${status.user?.username ? "@" + status.user.username : ""}`
              : "Не залогинен — войди по номеру телефона"}
          </p>
        </div>
        {status.logged_in && (
          <span
            role="button"
            tabIndex={0}
            onClick={e => { e.stopPropagation(); logout(); }}
            onKeyDown={e => { if (e.key === "Enter") { e.stopPropagation(); logout(); } }}
            className="px-3 py-2 rounded-xl border border-red-500/30 text-red-300 text-xs hover:bg-red-500/10 cursor-pointer"
          >
            Выйти
          </span>
        )}
        <Icon
          name="ChevronDown"
          size={18}
          className={`text-white/50 transition-transform flex-shrink-0 ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
      <div className="px-4 pb-4">
      {!status.logged_in && (
        <div className="space-y-3">
          {step === "idle" && (
            <>
              <input
                type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="+79991234567"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-cyan-500/50"
              />
              <button onClick={sendCode} disabled={loading}
                className="px-4 py-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-sm font-medium hover:bg-cyan-500/25 disabled:opacity-50">
                {loading ? "Отправка..." : "Получить код в Telegram"}
              </button>
              <p className="text-[11px] text-white/30">Код придёт в твой Telegram (не SMS!) от официального аккаунта Telegram.</p>
            </>
          )}

          {step === "code" && (
            <>
              <p className="text-xs text-white/60">Код отправлен в Telegram на номер {phone}</p>
              <input
                type="text" value={code} onChange={e => setCode(e.target.value)}
                placeholder="12345" inputMode="numeric"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-cyan-500/50 tracking-widest"
              />
              <div className="flex gap-2">
                <button onClick={verifyCode} disabled={loading}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-medium hover:bg-emerald-500/25 disabled:opacity-50">
                  {loading ? "Проверка..." : "Подтвердить"}
                </button>
                <button onClick={() => { setStep("idle"); setError(""); }}
                  className="px-4 py-2.5 rounded-xl border border-white/10 text-white/60 text-sm">Отмена</button>
              </div>
            </>
          )}

          {step === "2fa" && (
            <>
              <p className="text-xs text-white/60">У аккаунта включена двухфакторная защита. Введи облачный пароль Telegram:</p>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Облачный пароль"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-cyan-500/50"
              />
              <button onClick={verify2fa} disabled={loading}
                className="px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-medium hover:bg-emerald-500/25 disabled:opacity-50">
                {loading ? "Проверка..." : "Войти"}
              </button>
            </>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-red-300 text-xs flex items-center gap-2">
              <Icon name="AlertCircle" size={14} />{error}
            </div>
          )}
        </div>
      )}
      {status.logged_in && (
        <p className="text-xs text-white/40">Аккаунт подключён. Сторис будут публиковаться от его имени.</p>
      )}
      </div>
      )}
    </div>
  );
}

export default TgUserLogin;