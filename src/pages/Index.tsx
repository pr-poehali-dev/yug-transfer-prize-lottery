import { useMemo, useState } from "react";
import Icon from "@/components/ui/icon";
import { ADMIN_AUTH_URL, POSTS_SESSION_KEY } from "@/components/admin/adminTypes";

const BG = "https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/95ffefeb-bc16-4fb4-8928-92889e01b3ed.jpg";

export default function Index() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  const stars = useMemo(
    () => Array.from({ length: 70 }, () => ({
      top: Math.random() * 100, left: Math.random() * 100,
      size: Math.random() * 2 + 1, delay: Math.random() * 4, dur: 2 + Math.random() * 3,
    })),
    [],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(ADMIN_AUTH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password, scope: "posts" }),
      });
      const d = await res.json();
      if (d.ok) {
        sessionStorage.setItem(POSTS_SESSION_KEY, d.token);
        window.location.href = "/posts";
      } else setError(d.error || "Неверный логин или пароль");
    } catch {
      setError("Нет связи с сервером");
    }
    setLoading(false);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05060d] text-white flex items-center justify-center px-5">
      <style>{`
        @keyframes twinkle { 0%,100% { opacity: .2 } 50% { opacity: 1 } }
        @keyframes drift { from { transform: scale(1.05) translate(0,0) } to { transform: scale(1.15) translate(-2%,-1%) } }
        @keyframes orbit { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>

      <img src={BG} alt="" className="absolute inset-0 w-full h-full object-cover object-left opacity-95"
        style={{ animation: "drift 40s ease-in-out infinite alternate" }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(5,6,13,0.1)_0%,rgba(5,6,13,0.6)_80%)]" />
      {stars.map((s, i) => (
        <span key={i} className="absolute rounded-full bg-white"
          style={{ top: `${s.top}%`, left: `${s.left}%`, width: s.size, height: s.size,
            animation: `twinkle ${s.dur}s ease-in-out ${s.delay}s infinite` }} />
      ))}

      <div className={`relative w-full transition-all duration-500 ${open ? "max-w-xs" : "max-w-[220px]"}`}>
        <div className="pointer-events-none absolute left-1/2 top-1/2 w-[340px] h-[340px] -ml-[170px] -mt-[170px] rounded-full border border-white/5"
          style={{ animation: "orbit 30s linear infinite" }}>
          <span className="absolute -top-1 left-1/2 w-2 h-2 rounded-full bg-fuchsia-400 shadow-[0_0_12px_4px_rgba(232,121,249,0.6)]" />
        </div>

        <form onSubmit={submit}
          className={`relative rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_0_50px_-12px_rgba(168,85,247,0.45)] transition-all duration-500 ${open ? "p-5" : "p-4"}`}>
          <div className="flex justify-center">
            <img src="/kb-logo.png" alt="База знаний"
              className={`h-auto drop-shadow-[0_0_25px_rgba(217,70,239,0.45)] transition-all duration-500 ${open ? "w-24" : "w-32"}`} />
          </div>

          {!open && (
            <button type="button" onClick={() => setOpen(true)}
              className="mt-3 w-full grad-btn text-white rounded-xl py-2 text-sm font-semibold flex items-center justify-center gap-2">
              <Icon name="LogIn" size={15} />Войти
            </button>
          )}

          <div className={`grid transition-all duration-500 ease-out ${open ? "grid-rows-[1fr] opacity-100 mt-4" : "grid-rows-[0fr] opacity-0"}`}>
            <div className="overflow-hidden">
              <div className="space-y-2.5 p-0.5">
                <div className="relative">
                  <Icon name="User" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Логин" autoComplete="username"
                    tabIndex={open ? 0 : -1} autoFocus={open} key={open ? "o" : "c"}
                    className="space-input w-full rounded-xl bg-black/40 border border-white/10 pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-fuchsia-400/60 transition-colors" />
                </div>
                <div className="relative">
                  <Icon name="Lock" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль"
                    type={show ? "text" : "password"} autoComplete="current-password" tabIndex={open ? 0 : -1}
                    className="space-input w-full rounded-xl bg-black/40 border border-white/10 pl-9 pr-9 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-fuchsia-400/60 transition-colors" />
                  <button type="button" onClick={() => setShow((v) => !v)} tabIndex={open ? 0 : -1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
                    <Icon name={show ? "EyeOff" : "Eye"} size={15} />
                  </button>
                </div>
                {error && <div className="text-xs text-rose-300 text-center">{error}</div>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setOpen(false); setError(""); }} tabIndex={open ? 0 : -1}
                    className="px-3 rounded-xl border border-white/10 text-white/50 hover:text-white hover:bg-white/5">
                    <Icon name="X" size={15} />
                  </button>
                  <button type="submit" disabled={loading || !login || !password} tabIndex={open ? 0 : -1}
                    className="flex-1 grad-btn text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                    {loading ? <Icon name="Loader2" size={15} className="animate-spin" /> : <Icon name="LogIn" size={15} />}
                    Войти
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
