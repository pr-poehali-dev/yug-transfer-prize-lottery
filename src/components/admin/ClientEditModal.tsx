import { useState } from "react";
import Icon from "@/components/ui/icon";
import { Client, ADMIN_CLIENTS_URL } from "./adminTypes";

interface ClientEditModalProps {
  client: Client;
  token: string;
  onClose: () => void;
  onSaved: (updated: Partial<Client>) => void;
}

export function ClientEditModal({ client, token, onClose, onSaved }: ClientEditModalProps) {
  const fullName = [client.first_name, client.last_name].filter(Boolean).join(" ") || client.username || "Клиент";

  const [firstName, setFirstName] = useState(client.first_name || "");
  const [lastName, setLastName] = useState(client.last_name || "");
  const [phone, setPhone] = useState(client.phone || "");
  const [balance, setBalance] = useState(String(client.balance ?? 0));
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    setSaving(true); setError(""); setSuccess(false);
    try {
      const body: Record<string, string | number> = { user_id: client.id };
      if (firstName !== client.first_name) body.first_name = firstName;
      if (lastName !== (client.last_name || "")) body.last_name = lastName;
      if (phone !== (client.phone || "")) body.phone = phone;
      if (String(balance) !== String(client.balance)) body.balance = Number(balance);
      if (password) body.password = password;

      if (Object.keys(body).length === 1) { setSaving(false); return; }

      const res = await fetch(ADMIN_CLIENTS_URL, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Ошибка");
      setSuccess(true);
      setPassword("");
      onSaved({ first_name: firstName, last_name: lastName, phone, balance: Number(balance) });
      setTimeout(onClose, 800);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#1a1025] rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold shrink-0 overflow-hidden">
            {client.photo_url
              ? <img src={client.photo_url} alt="" className="w-full h-full object-cover" />
              : (client.first_name[0] || "?").toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">{fullName}</p>
            <p className="text-muted-foreground text-xs">Редактирование клиента</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors">
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Имя</label>
              <input
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-3 py-2.5 text-white text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Фамилия</label>
              <input
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-3 py-2.5 text-white text-sm outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Телефон</label>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+79001234567"
              className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-3 py-2.5 text-white text-sm outline-none"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Баланс (₽)</label>
            <input
              type="number"
              value={balance}
              onChange={e => setBalance(e.target.value)}
              className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-3 py-2.5 text-white text-sm outline-none"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Новый пароль</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Оставьте пустым — не менять"
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-3 py-2.5 pr-10 text-white text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
              >
                <Icon name={showPassword ? "EyeOff" : "Eye"} size={15} />
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              <Icon name="AlertCircle" size={14} />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
              <Icon name="CheckCircle" size={14} />
              Сохранено!
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 pt-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white text-sm font-medium transition-colors">
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 grad-btn py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Сохраняем...</>
              : <><Icon name="Save" size={15} />Сохранить</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ClientEditModal;
