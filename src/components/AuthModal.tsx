import { useState } from "react";
import Icon from "@/components/ui/icon";
import type { AppUser } from "@/pages/Index";

const AUTH_URL = "https://functions.poehali.dev/3668a161-208c-46c4-8691-84fa9d9586b0";

type AuthMode = "login" | "register";

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";
  const d = digits.startsWith("8") ? "7" + digits.slice(1) : digits.startsWith("7") ? digits : "7" + digits;
  const p = d.slice(1);
  let result = "+7";
  if (p.length > 0) result += " (" + p.slice(0, 3);
  if (p.length >= 3) result += ") " + p.slice(3, 6);
  if (p.length >= 6) result += "-" + p.slice(6, 8);
  if (p.length >= 8) result += "-" + p.slice(8, 10);
  return result;
}

export function AuthModal({ onClose, onLogin }: { onClose: () => void; onLogin?: (user: AppUser) => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const body: Record<string, string> = { action: mode, phone: phone.replace(/\D/g, ""), password };
      if (mode === "register") body.first_name = name;
      const res = await fetch(AUTH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok && onLogin) {
        onLogin(data.user as AppUser);
      } else {
        setError(data.error || "Ошибка входа");
      }
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" />

      <div className="relative w-full max-w-md animate-scale-in" style={{ animationFillMode: "forwards" }}>
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 rounded-3xl blur-lg opacity-40" />

        <div className="relative glass rounded-3xl overflow-hidden border border-white/10">
          <div className="h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400" />

          <div className="p-8">
            <button onClick={onClose}
              className="absolute top-5 right-5 w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-white transition-colors">
              <Icon name="X" size={16} />
            </button>

            <div className="flex justify-center mb-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl animate-float">🎰</div>
            </div>

            <div className="flex bg-white/10 rounded-2xl p-1 mb-5">
              {(["login", "register"] as const).map((m) => (
                <button key={m} onClick={() => { setMode(m); setError(""); }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${mode === m ? "grad-btn shadow-lg" : "text-muted-foreground hover:text-white"}`}>
                  {m === "login" ? "Войти" : "Регистрация"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === "register" && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wider">Имя</label>
                  <div className="relative">
                    <Icon name="User" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Ваше имя"
                      className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl pl-10 pr-4 py-3 text-white placeholder-muted-foreground text-sm outline-none transition-colors" />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wider">Номер телефона</label>
                <div className="relative">
                  <Icon name="Phone" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="tel" required value={phone} onChange={e => setPhone(formatPhone(e.target.value))} placeholder="+7 (___) ___-__-__"
                    className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl pl-10 pr-4 py-3 text-white placeholder-muted-foreground text-sm outline-none transition-colors" />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wider">Пароль</label>
                <div className="relative">
                  <Icon name="Lock" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type={showPass ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                    className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl pl-10 pr-10 py-3 text-white placeholder-muted-foreground text-sm outline-none transition-colors" />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors">
                    <Icon name={showPass ? "EyeOff" : "Eye"} size={16} />
                  </button>
                </div>
              </div>

              {error && <p className="text-red-400 text-sm text-center">{error}</p>}

              <button type="submit" disabled={loading}
                className="w-full grad-btn rounded-xl py-3.5 font-bold flex items-center justify-center gap-2 disabled:opacity-70">
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Загрузка...</>
                  : <><Icon name={mode === "register" ? "UserPlus" : "LogIn"} size={16} />{mode === "register" ? "Создать аккаунт" : "Войти"}</>
                }
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}