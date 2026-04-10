import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import type { AppUser } from "@/pages/Index";
import { AUTH_URL, TG_BOT_ID } from "./cabinet-types";

export function EditProfileModal({ user, onClose, onSave }: { user: AppUser; onClose: () => void; onSave: (u: AppUser) => void }) {
  const [name, setName] = useState(user.first_name || "");
  const [phone, setPhone] = useState((user as AppUser & { phone?: string }).phone || "");
  const [newPassword, setNewPassword] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [photoUrl, setPhotoUrl] = useState(user.photo_url || "");
  const [loading, setLoading] = useState(false);
  const [tgLinking, setTgLinking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const hasTg = !!(user.telegram_id && user.telegram_id !== 0);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleLinkTelegram = () => {
    setTgLinking(true);
    setError(""); setSuccess("");
    const origin = encodeURIComponent(window.location.origin);
    localStorage.setItem("tg_link_user_id", String(user.id));
    window.location.href = `https://oauth.telegram.org/auth?bot_id=${TG_BOT_ID}&origin=${origin}&request_access=write&lang=ru`;
  };

  const handleSave = async () => {
    setLoading(true); setError(""); setSuccess("");
    try {
      const body: Record<string, string> = { action: "update_profile", user_id: String(user.id), first_name: name };
      if (phone) body.phone = phone.replace(/\D/g, "");
      if (newPassword) { body.new_password = newPassword; body.old_password = oldPassword; }
      if (photoUrl && photoUrl.startsWith("data:")) body.photo_data = photoUrl;
      const res = await fetch(AUTH_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.ok) {
        setSuccess("Профиль сохранён!");
        onSave({ ...user, first_name: name, photo_url: data.photo_url || photoUrl });
      } else {
        setError(data.error || "Ошибка сохранения");
      }
    } catch { setError("Ошибка соединения"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm">
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 rounded-3xl blur-lg opacity-40" />
        <div className="relative glass rounded-3xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-oswald text-xl font-bold text-white">Редактировать профиль</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-full glass flex items-center justify-center text-muted-foreground hover:text-white">
              <Icon name="X" size={16} />
            </button>
          </div>

          {/* Фото */}
          <div className="flex flex-col items-center mb-5">
            <div className="relative cursor-pointer" onClick={() => fileRef.current?.click()}>
              {photoUrl ? (
                <img src={photoUrl} className="w-20 h-20 rounded-2xl object-cover border-2 border-purple-500/40" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl font-bold text-white">
                  {name[0]?.toUpperCase() || "?"}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-purple-500 rounded-full flex items-center justify-center border-2 border-background">
                <Icon name="Camera" size={13} className="text-white" />
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            <p className="text-xs text-muted-foreground mt-2">Нажми на фото чтобы изменить</p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block uppercase tracking-wider">Имя</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ваше имя"
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-4 py-2.5 text-white text-sm outline-none" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block uppercase tracking-wider">Номер телефона</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 (___) ___-__-__"
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-4 py-2.5 text-white text-sm outline-none" />
            </div>
            <div className="border-t border-white/10 pt-3">
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Сменить пароль</p>
              <input value={oldPassword} onChange={e => setOldPassword(e.target.value)} type="password" placeholder="Текущий пароль"
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-4 py-2.5 text-white text-sm outline-none mb-2" />
              <input value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password" placeholder="Новый пароль"
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-4 py-2.5 text-white text-sm outline-none" />
            </div>
          </div>

          {/* Привязка Telegram */}
          <div className="border-t border-white/10 pt-3 mt-1">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Telegram</p>
            {hasTg ? (
              <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#2AABEE"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 13.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.828.942z"/></svg>
                <span className="text-emerald-400 text-sm font-medium">Telegram привязан</span>
                <Icon name="Check" size={14} className="text-emerald-400 ml-auto" />
              </div>
            ) : (
              <button onClick={handleLinkTelegram} disabled={tgLinking}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-[#2AABEE]/40 bg-[#2AABEE]/10 hover:bg-[#2AABEE]/20 text-[#2AABEE] transition-all text-sm font-semibold disabled:opacity-70">
                {tgLinking ? <div className="w-4 h-4 border-2 border-[#2AABEE]/30 border-t-[#2AABEE] rounded-full animate-spin" /> : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 13.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.828.942z"/></svg>
                )}
                Привязать Telegram
              </button>
            )}
          </div>

          {error && <p className="text-red-400 text-sm text-center mt-3">{error}</p>}
          {success && <p className="text-emerald-400 text-sm text-center mt-3">{success}</p>}

          <button onClick={handleSave} disabled={loading}
            className="w-full grad-btn rounded-xl py-3 font-bold mt-4 flex items-center justify-center gap-2 disabled:opacity-70">
            {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Сохранение...</> : <><Icon name="Save" size={16} />Сохранить</>}
          </button>
        </div>
      </div>
    </div>
  );
}
