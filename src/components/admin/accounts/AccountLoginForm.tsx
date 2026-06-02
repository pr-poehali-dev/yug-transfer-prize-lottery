type Step = "idle" | "phone" | "code" | "2fa";

interface AccountLoginFormProps {
  step: Step;
  phone: string;
  code: string;
  pwd: string;
  label: string;
  busy: boolean;
  err: string | null;
  onPhone: (v: string) => void;
  onCode: (v: string) => void;
  onPwd: (v: string) => void;
  onLabel: (v: string) => void;
  onSendCode: () => void;
  onVerifyCode: () => void;
  onVerify2fa: () => void;
  onCancel: () => void;
}

export function AccountLoginForm({
  step,
  phone,
  code,
  pwd,
  label,
  busy,
  err,
  onPhone,
  onCode,
  onPwd,
  onLabel,
  onSendCode,
  onVerifyCode,
  onVerify2fa,
  onCancel,
}: AccountLoginFormProps) {
  return (
    <div className="border border-white/10 rounded-xl p-4 bg-white/[0.02] space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">
          {step === "phone" && "Шаг 1: номер телефона"}
          {step === "code" && "Шаг 2: код из Telegram"}
          {step === "2fa" && "Шаг 3: пароль 2FA"}
        </div>
        <button onClick={onCancel} className="text-xs text-muted-foreground hover:text-white">
          Отмена
        </button>
      </div>

      {step === "phone" && (
        <>
          <input
            type="tel" placeholder="+79991234567" value={phone}
            onChange={(e) => onPhone(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <input
            type="text" placeholder="Название (например: Запасной 1) — опционально" value={label}
            onChange={(e) => onLabel(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <button onClick={onSendCode} disabled={busy}
            className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-sm hover:opacity-90 transition disabled:opacity-50">
            {busy ? "Отправка..." : "Отправить код"}
          </button>
        </>
      )}

      {step === "code" && (
        <>
          <div className="text-xs text-muted-foreground">Код отправлен на {phone}</div>
          <input
            type="text" inputMode="numeric" placeholder="12345" value={code}
            onChange={(e) => onCode(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 tracking-widest text-center font-mono"
          />
          <button onClick={onVerifyCode} disabled={busy}
            className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-sm hover:opacity-90 transition disabled:opacity-50">
            {busy ? "Проверка..." : "Подтвердить"}
          </button>
        </>
      )}

      {step === "2fa" && (
        <>
          <div className="text-xs text-muted-foreground">Аккаунт защищён двухфакторной авторизацией</div>
          <input
            type="password" placeholder="Пароль 2FA" value={pwd}
            onChange={(e) => onPwd(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <button onClick={onVerify2fa} disabled={busy}
            className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-sm hover:opacity-90 transition disabled:opacity-50">
            {busy ? "Проверка..." : "Войти"}
          </button>
        </>
      )}

      {err && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2">
          {err}
        </div>
      )}
    </div>
  );
}

export default AccountLoginForm;
