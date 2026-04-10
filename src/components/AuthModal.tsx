import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import type { AppUser } from "@/pages/Index";

const CABINET_URL = "https://functions.poehali.dev/0ad2d0a9-bb39-4116-9934-9460e7841500";

const TELEGRAM_BOT_USERNAME = "UG_GIFTBOT";
const TELEGRAM_AUTH_URL = "https://functions.poehali.dev/4f5fad1d-038c-4bc7-9488-0747551c3978";

type AuthMode = "login" | "register" | "forgot";

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

declare global {
  interface Window {
    onTelegramAuth: (user: TelegramUser) => void;
  }
}

function TelegramLoginButton({ onAuth }: { onAuth: (user: TelegramUser) => void }) {
  const handleClick = () => {
    const returnUrl = encodeURIComponent(window.location.origin + '/?tg_auth=1');
    window.location.href = `https://oauth.telegram.org/auth?bot_id=8567041422&origin=${encodeURIComponent(window.location.origin)}&return_to=${returnUrl}&request_access=write&lang=ru`;
  };

  return (
    <button type="button" onClick={handleClick}
      className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl border border-[#2AABEE]/40 bg-[#2AABEE]/10 hover:bg-[#2AABEE]/20 text-[#2AABEE] transition-all text-sm font-semibold">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 13.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.828.942z"/>
      </svg>
      Войти через Telegram
    </button>
  );
}

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
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tgLoading, setTgLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [user, setUser] = useState<TelegramUser | null>(null);
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { setLoading(false); setDone(true); }, 1400);
  };

  const handleTgAuth = async (tgUser: TelegramUser) => {
    setTgLoading(true);
    try {
      const res = await fetch(TELEGRAM_AUTH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...tgUser }),
      });
      const data = await res.json();
      if (data.ok) {
        setUser(tgUser);
        setDone(true);
        try {
          const profileRes = await fetch(CABINET_URL, {
              headers: { 'X-User-Id': String(data.user.id) },
            });
            const profile = await profileRes.json();
            if (profile.ok && onLogin) {
              onLogin(profile.user as AppUser);
            } else if (onLogin) {
              // Fallback — используем минимальные данные
              onLogin({
                id: data.user.id,
                telegram_id: data.user.telegram_id,
                first_name: data.user.first_name || tgUser.first_name,
                last_name: data.user.last_name,
                username: data.user.username,
                photo_url: data.user.photo_url || tgUser.photo_url,
                balance: 0,
                total_entries: 0,
                total_spent: 0,
                wins: 0,
              });
            }
          } catch {
            if (onLogin) {
              onLogin({
                id: data.user.id,
                telegram_id: data.user.telegram_id,
                first_name: data.user.first_name || tgUser.first_name,
                last_name: data.user.last_name,
                username: data.user.username,
                photo_url: data.user.photo_url || tgUser.photo_url,
                balance: 0,
                total_entries: 0,
                total_spent: 0,
                wins: 0,
              });
            }
          }
        }
      } finally {
        setTgLoading(false);
      }
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
          <div className="h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400" />

          <div className="p-8">
            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-5 right-5 w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-white transition-colors"
            >
              <Icon name="X" size={16} />
            </button>

                {/* Logo */}
                <div className="flex justify-center mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-4xl animate-float">
                    🎰
                  </div>
                </div>

                <h2 className="font-oswald text-2xl font-bold text-white text-center mb-2">Войти в кабинет</h2>
                <p className="text-muted-foreground text-sm text-center mb-8">Используй Telegram — быстро и безопасно</p>

                {tgLoading ? (
                  <div className="w-full flex items-center justify-center gap-2 py-4 text-[#2AABEE] text-sm">
                    <div className="w-5 h-5 border-2 border-[#2AABEE]/30 border-t-[#2AABEE] rounded-full animate-spin" />
                    Подключение к Telegram...
                  </div>
                ) : (
                  <TelegramLoginButton onAuth={handleTgAuth} />
                )}

                <p className="text-center text-xs text-muted-foreground mt-6">
                  Нажимая кнопку, ты соглашаешься с{" "}
                  <span className="text-purple-400 cursor-pointer hover:underline">правилами сервиса</span>
                </p>
          </div>
        </div>
      </div>
    </div>
  );
}