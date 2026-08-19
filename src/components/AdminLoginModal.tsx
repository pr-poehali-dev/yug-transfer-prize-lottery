import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ADMIN_AUTH_URL, POSTS_SESSION_KEY } from "@/components/admin/adminTypes";

export default function AdminLoginModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(ADMIN_AUTH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password, scope: "posts" }),
      });
      const data = await res.json();
      if (data.ok) {
        sessionStorage.setItem(POSTS_SESSION_KEY, data.token);
        onOpenChange(false);
        navigate("/posts");
      } else setError(data.error || "Ошибка входа");
    } catch {
      setError("Нет соединения с сервером");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm bg-[#15151b] border-white/10 p-0 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400" />
        <div className="p-6">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-2xl">
              🔐
            </div>
          </div>
          <h2 className="text-xl font-bold text-white text-center mb-1">Вход в админку</h2>
          <p className="text-white/50 text-xs text-center mb-5">Мой Трансфер</p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Icon name="User" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                required
                autoFocus
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="Логин"
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/40 text-sm outline-none transition-colors"
              />
            </div>
            <div className="relative">
              <Icon name="Lock" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type={showPass ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Пароль"
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl pl-10 pr-10 py-3 text-white placeholder-white/40 text-sm outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
              >
                <Icon name={showPass ? "EyeOff" : "Eye"} size={16} />
              </button>
            </div>
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 text-red-400 text-sm flex items-center gap-2">
                <Icon name="AlertCircle" size={15} />
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-3 font-bold text-white bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Вход...
                </>
              ) : (
                <>
                  <Icon name="LogIn" size={16} />
                  Войти
                </>
              )}
            </button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
