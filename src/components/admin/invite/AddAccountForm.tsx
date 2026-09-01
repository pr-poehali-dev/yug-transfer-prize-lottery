import { useState } from "react";
import { toast } from "sonner";
import Icon from "@/components/ui/icon";
import { TG_ACCOUNTS_URL } from "../adminTypes";

type Step = "phone" | "code" | "pass";

export function AddAccountForm({ token, onDone }: { token: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [pass, setPass] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const call = async (action: string, body: Record<string, string>) => {
    let last: { ok?: boolean; error?: string; need_2fa?: boolean; id?: number } = {};
    for (let i = 0; i < 3; i++) {
      try {
        const res = await fetch(`${TG_ACCOUNTS_URL}?action=${action}`, {
          method: "POST",
          headers: { "X-Admin-Token": token, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        last = await res.json();
      } catch {
        last = { ok: false, error: "timeout" };
      }
      if (last.ok || last.need_2fa) return last;
      const e = (last.error || "").toLowerCase();
      if (!(e.includes("timeout") || e.includes("connect") || !e)) return last;
      await new Promise(r => setTimeout(r, 1200));
    }
    return last;
  };

  const reset = () => {
    setStep("phone"); setPhone(""); setCode(""); setPass(""); setLabel(""); setOpen(false);
  };

  const sendCode = async () => {
    if (!phone.trim()) return toast.error("Введи номер телефона");
    setBusy(true);
    try {
      const d = await call("send_code", { phone: phone.trim() });
      if (d.ok) { setStep("code"); toast.success("Код отправлен в Telegram"); }
      else toast.error(d.error || "Не удалось отправить код");
    } catch { toast.error("Нет связи с сервером"); }
    finally { setBusy(false); }
  };

  const verifyCode = async () => {
    if (!code.trim()) return toast.error("Введи код из Telegram");
    setBusy(true);
    try {
      const d = await call("verify_code", { phone: phone.trim(), code: code.trim(), label: label.trim() });
      if (d.ok) { toast.success("Аккаунт добавлен"); onDone(); reset(); }
      else if (d.need_2fa) { setStep("pass"); toast.info("Нужен пароль двухфакторки"); }
      else toast.error(d.error || "Неверный код");
    } catch { toast.error("Нет связи с сервером"); }
    finally { setBusy(false); }
  };

  const verify2fa = async () => {
    if (!pass) return toast.error("Введи пароль");
    setBusy(true);
    try {
      const d = await call("verify_2fa", { phone: phone.trim(), password: pass, label: label.trim() });
      if (d.ok) { toast.success("Аккаунт добавлен"); onDone(); reset(); }
      else toast.error(d.error || "Неверный пароль");
    } catch { toast.error("Нет связи с сервером"); }
    finally { setBusy(false); }
  };

  const inputCls =
    "w-full rounded-lg bg-black/30 border border-white/10 px-2.5 py-2 text-[12px] text-white placeholder:text-white/25 outline-none focus:border-emerald-400/50";
  const btnCls =
    "w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-[12px] font-semibold transition-colors flex items-center justify-center gap-1.5";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full mt-2 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-[11px] font-medium transition-colors flex items-center justify-center gap-1.5"
      >
        <Icon name="Plus" size={13} /> Добавить аккаунт
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-xl bg-black/25 border border-white/10 p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-white/70 font-medium">
          {step === "phone" && "Вход в Telegram"}
          {step === "code" && "Код из Telegram"}
          {step === "pass" && "Пароль двухфакторки"}
        </p>
        <button type="button" onClick={reset} className="text-white/40 hover:text-white">
          <Icon name="X" size={14} />
        </button>
      </div>

      {step === "phone" && (
        <>
          <input className={inputCls} value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="+7 900 000 00 00" inputMode="tel" />
          <input className={inputCls} value={label} onChange={e => setLabel(e.target.value)}
            placeholder="Имя аккаунта (необязательно)" />
          <button type="button" className={btnCls} onClick={sendCode} disabled={busy}>
            <Icon name={busy ? "Loader2" : "Send"} size={13} className={busy ? "animate-spin" : ""} />
            Получить код
          </button>
        </>
      )}

      {step === "code" && (
        <>
          <p className="text-[10px] text-white/40">Код придёт в приложение Telegram на {phone}</p>
          <input className={inputCls} value={code} onChange={e => setCode(e.target.value)}
            placeholder="12345" inputMode="numeric" />
          <button type="button" className={btnCls} onClick={verifyCode} disabled={busy}>
            <Icon name={busy ? "Loader2" : "Check"} size={13} className={busy ? "animate-spin" : ""} />
            Подтвердить
          </button>
          <button type="button" onClick={() => setStep("phone")}
            className="w-full text-[10px] text-white/40 hover:text-white/70">
            Изменить номер
          </button>
        </>
      )}

      {step === "pass" && (
        <>
          <input className={inputCls} type="password" value={pass} onChange={e => setPass(e.target.value)}
            placeholder="Пароль облачного хранилища" />
          <button type="button" className={btnCls} onClick={verify2fa} disabled={busy}>
            <Icon name={busy ? "Loader2" : "Check"} size={13} className={busy ? "animate-spin" : ""} />
            Войти
          </button>
        </>
      )}
    </div>
  );
}

export default AddAccountForm;