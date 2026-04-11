import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import type { AppUser } from "@/pages/Index";
import { AUTH_URL } from "./cabinet-types";

export function EditProfileModal({ user, onClose, onSave }: { user: AppUser; onClose: () => void; onSave: (u: AppUser) => void }) {
  const [name, setName] = useState(user.first_name || "");
  const [phone, setPhone] = useState((user as AppUser & { phone?: string }).phone || "");
  const [newPassword, setNewPassword] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [photoUrl, setPhotoUrl] = useState(user.photo_url || "");
  const [tgUsername, setTgUsername] = useState(user.username || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setLoading(true); setError(""); setSuccess("");
    try {
      const body: Record<string, string> = { action: "update_profile", user_id: String(user.id), first_name: name };
      if (phone) body.phone = phone.replace(/\D/g, "");
      if (tgUsername) body.username = tgUsername.replace("@", "").trim();
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
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" />
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

          {/* Telegram username */}
          <div className="border-t border-white/10 pt-3 mt-1">
            <label className="text-xs text-muted-foreground mb-1 block uppercase tracking-wider">Telegram username</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
              <input value={tgUsername} onChange={e => setTgUsername(e.target.value.replace("@", ""))} placeholder="username"
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl pl-8 pr-4 py-2.5 text-white text-sm outline-none" />
            </div>
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