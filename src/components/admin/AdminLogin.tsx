import { useState } from "react";
import Icon from "@/components/ui/icon";
import { ADMIN_AUTH_URL, SESSION_KEY } from "./adminTypes";

export function AdminLogin({ onSuccess }: { onSuccess: (token: string) => void }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch(ADMIN_AUTH_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      const data = await res.json();
      if (data.ok) { sessionStorage.setItem(SESSION_KEY, data.token); onSuccess(data.token); }
      else setError(data.error || "Ошибка входа");
    } catch { setError("Нет соединения с сервером"); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center p-4">
      <div className="relative w-full max-w-sm">
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 rounded-3xl blur-lg opacity-40" />
        <div className="relative glass rounded-3xl overflow-hidden border border-white/10">
          <div className="h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400" />
          <div className="p-8">
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl">🔐</div>
            </div>
            <h1 className="font-oswald text-2xl font-bold text-white text-center mb-1">Панель управления</h1>
            <p className="text-muted-foreground text-sm text-center mb-6">ЮГ ТРАНСФЕР — Администратор</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block font-medium uppercase tracking-wider">Логин</label>
                <div className="relative">
                  <Icon name="User" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="text" required value={login} onChange={e => setLogin(e.target.value)} placeholder="Введите логин"
                    className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl pl-10 pr-4 py-3 text-white placeholder-muted-foreground text-sm outline-none transition-colors" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block font-medium uppercase tracking-wider">Пароль</label>
                <div className="relative">
                  <Icon name="Lock" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type={showPass ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                    className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl pl-10 pr-10 py-3 text-white placeholder-muted-foreground text-sm outline-none transition-colors" />
                  <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors">
                    <Icon name={showPass ? "EyeOff" : "Eye"} size={16} />
                  </button>
                </div>
              </div>
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
                  <Icon name="AlertCircle" size={16} />{error}
                </div>
              )}
              <button type="submit" disabled={loading} className="w-full grad-btn rounded-xl py-3.5 font-bold font-golos flex items-center justify-center gap-2 disabled:opacity-70">
                {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Вход...</> : <><Icon name="LogIn" size={16} />Войти в панель</>}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
