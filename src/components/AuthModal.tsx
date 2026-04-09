import { useState } from "react";
import Icon from "@/components/ui/icon";

type AuthMode = "login" | "register" | "forgot";

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

export function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [phone, setPhone] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { setLoading(false); setDone(true); }, 1400);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" />

      {/* Modal */}
      <div className="relative w-full max-w-md animate-scale-in" style={{ animationFillMode: "forwards" }}>
        {/* Glow */}
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 rounded-3xl blur-lg opacity-40" />

        <div className="relative glass rounded-3xl overflow-hidden border border-white/10">
          {/* Top gradient bar */}
          <div className="h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400" />

          <div className="p-8">
            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-5 right-5 w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-white transition-colors"
            >
              <Icon name="X" size={16} />
            </button>

            {done ? (
              <div className="text-center py-6">
                <div className="text-6xl mb-4 animate-float inline-block">🎉</div>
                <h2 className="font-oswald text-3xl font-bold text-white mb-2">
                  {mode === "forgot" ? "Письмо отправлено!" : mode === "register" ? "Добро пожаловать!" : "С возвращением!"}
                </h2>
                <p className="text-muted-foreground text-sm mb-6">
                  {mode === "forgot"
                    ? "Код отправлен на твой номер телефона."
                    : "Теперь ты в игре. Удача на твоей стороне!"}
                </p>
                <button onClick={onClose} className="grad-btn rounded-xl px-8 py-3 font-semibold">
                  Вперёд!
                </button>
              </div>
            ) : (
              <>
                {/* Logo */}
                <div className="flex justify-center mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl animate-float">
                    🎰
                  </div>
                </div>

                {/* Tabs */}
                {mode !== "forgot" && (
                  <div className="flex bg-secondary rounded-2xl p-1 mb-6">
                    {(["login", "register"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMode(m)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                          mode === m
                            ? "grad-btn shadow-lg"
                            : "text-muted-foreground hover:text-white"
                        }`}
                      >
                        {m === "login" ? "Войти" : "Регистрация"}
                      </button>
                    ))}
                  </div>
                )}

                {mode === "forgot" && (
                  <div className="mb-6">
                    <button
                      onClick={() => setMode("login")}
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-white transition-colors mb-4"
                    >
                      <Icon name="ArrowLeft" size={14} />
                      Назад
                    </button>
                    <h2 className="font-oswald text-2xl font-bold text-white mb-1">Забыли пароль?</h2>
                    <p className="text-muted-foreground text-sm">Введите номер телефона — пришлём код для сброса</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {mode === "register" && (
                    <div className="animate-fade-in-up" style={{ animationFillMode: "forwards" }}>
                      <label className="text-xs text-muted-foreground mb-1.5 block font-medium uppercase tracking-wider">Имя</label>
                      <div className="relative">
                        <Icon name="User" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          required
                          placeholder="Ваше имя"
                          className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl pl-10 pr-4 py-3 text-white placeholder-muted-foreground text-sm outline-none transition-colors"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block font-medium uppercase tracking-wider">Номер телефона</label>
                    <div className="relative">
                      <Icon name="Phone" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={handlePhoneChange}
                        placeholder="+7 (___) ___-__-__"
                        className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl pl-10 pr-4 py-3 text-white placeholder-muted-foreground text-sm outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {mode !== "forgot" && (
                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block font-medium uppercase tracking-wider">Пароль</label>
                      <div className="relative">
                        <Icon name="Lock" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type={showPass ? "text" : "password"}
                          required
                          placeholder="••••••••"
                          className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl pl-10 pr-10 py-3 text-white placeholder-muted-foreground text-sm outline-none transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass(v => !v)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                        >
                          <Icon name={showPass ? "EyeOff" : "Eye"} size={16} />
                        </button>
                      </div>
                    </div>
                  )}

                  {mode === "register" && (
                    <div className="animate-fade-in-up" style={{ animationFillMode: "forwards" }}>
                      <label className="text-xs text-muted-foreground mb-1.5 block font-medium uppercase tracking-wider">Повторите пароль</label>
                      <div className="relative">
                        <Icon name="Lock" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type={showPass ? "text" : "password"}
                          required
                          placeholder="••••••••"
                          className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl pl-10 pr-4 py-3 text-white placeholder-muted-foreground text-sm outline-none transition-colors"
                        />
                      </div>
                    </div>
                  )}

                  {mode === "login" && (
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => setMode("forgot")}
                        className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        Забыли пароль?
                      </button>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full grad-btn rounded-xl py-3.5 font-bold font-golos flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Загрузка...
                      </>
                    ) : (
                      <>
                        <Icon name={mode === "forgot" ? "Send" : mode === "register" ? "UserPlus" : "LogIn"} size={16} />
                        {mode === "forgot" ? "Отправить письмо" : mode === "register" ? "Создать аккаунт" : "Войти"}
                      </>
                    )}
                  </button>

                  {/* Social */}
                  {mode !== "forgot" && (
                    <div>
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-white/10" />
                        <span className="text-xs text-muted-foreground">или войди через</span>
                        <div className="flex-1 h-px bg-white/10" />
                      </div>
                      <button
                        type="button"
                        className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl border border-[#2AABEE]/30 bg-[#2AABEE]/10 hover:bg-[#2AABEE]/20 hover:border-[#2AABEE]/60 text-[#2AABEE] transition-all text-sm font-semibold"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 13.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.828.942z"/>
                        </svg>
                        Войти через Telegram
                      </button>
                    </div>
                  )}
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}