import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import { TG_LOOKUP_API, inputCls } from "./listTypes";

interface Account {
  id: number;
  label: string;
  phone: string;
  banned: boolean;
  paused_until?: string | null;
  main?: boolean;
  purpose?: "bot" | "scan";
}

const API = `${TG_LOOKUP_API}?action=accounts`;

const VIA_TEXT: Record<string, string> = {
  app: "Код отправлен в приложение Telegram",
  sms: "Код отправлен по СМС",
  call: "Telegram позвонит — код будет в номере или продиктуют голосом",
  fragment: "Код отправлен через Fragment",
  email: "Код отправлен на почту, привязанную к аккаунту",
};

const NEXT_TEXT: Record<string, string> = {
  sms: "прислать по СМС",
  call: "получить звонком",
  fragment: "прислать через Fragment",
  email: "прислать на почту",
};

function pauseText(until?: string | null) {
  if (!until) return "";
  const m = Math.max(1, Math.ceil((new Date(until).getTime() - Date.now()) / 60000));
  return m >= 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m} мин`;
}

export function ScanAccounts({ token }: { token: string }) {
  const [items, setItems] = useState<Account[]>([]);
  const [adding, setAdding] = useState(false);
  const [step, setStep] = useState<"phone" | "code" | "password">("phone");
  const [phone, setPhone] = useState("");
  const [label, setLabel] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [purpose, setPurpose] = useState<"bot" | "scan">("scan");
  const [busy, setBusy] = useState(false);
  const [via, setVia] = useState("");
  const [nextVia, setNextVia] = useState("");

  const call = async (body?: object) => {
    const r = await fetch(API, {
      method: body ? "POST" : "GET",
      headers: { "X-Admin-Token": token, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return r.json();
  };

  const load = async () => {
    try {
      const d = await call();
      if (d.ok) setItems(d.items || []);
    } catch { /* */ }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = () => {
    setAdding(false);
    setStep("phone");
    setPhone("");
    setLabel("");
    setCode("");
    setPassword("");
    setPurpose("scan");
    setVia("");
    setNextVia("");
  };

  const sendCode = async () => {
    setBusy(true);
    try {
      const d = await call({ op: "send_code", phone });
      if (d.ok) {
        setStep("code");
        setVia(d.via || "");
        setNextVia(d.next || "");
        toast.success(VIA_TEXT[d.via as string] || "Код отправлен");
      } else toast.error(d.error || "Не удалось отправить код");
    } catch {
      toast.error("Не удалось отправить код");
    }
    setBusy(false);
  };

  const resendCode = async () => {
    setBusy(true);
    try {
      const d = await call({ op: "resend_code", phone });
      if (d.ok) {
        setVia(d.via || "");
        setNextVia(d.next || "");
        toast.success(VIA_TEXT[d.via as string] || "Код отправлен повторно");
      } else toast.error(d.error || "Не удалось отправить код повторно");
    } catch {
      toast.error("Не удалось отправить код повторно");
    }
    setBusy(false);
  };

  const signIn = async () => {
    setBusy(true);
    try {
      const d = await call({ op: "sign_in", phone, code: step === "password" ? "" : code, password, label, purpose });
      if (d.ok) {
        toast.success(`Аккаунт подключён: ${d.label}`);
        reset();
        load();
      } else {
        if (d.need_password) setStep("password");
        toast.error(d.error || "Не удалось войти");
      }
    } catch {
      toast.error("Не удалось войти");
    }
    setBusy(false);
  };

  const [outId, setOutId] = useState<string>("");

  const logout = async (a: Account) => {
    if (!confirm(`Разлогинить «${a.label}»?\n\nСессия сканера будет завершена в Telegram, аккаунт перестанет участвовать в сканировании. Подключить снова можно через «Добавить аккаунт».`)) return;
    const k = `${a.main ? "m" : a.id}`;
    setOutId(k);
    try {
      const d = await call({ op: "logout", id: a.id, main: !!a.main });
      if (d.ok) toast.success(d.logged_out ? "Аккаунт разлогинен" : "Аккаунт убран из сканера");
      else toast.error(d.error || "Не удалось разлогинить");
    } catch {
      toast.error("Не удалось разлогинить");
    }
    setOutId("");
    load();
  };

  const togglePurpose = async (a: Account) => {
    const next = a.purpose === "bot" ? "scan" : "bot";
    await call({ op: "purpose", id: a.id, purpose: next });
    toast.success(next === "bot" ? "Аккаунт работает только на поиск в боте" : "Аккаунт работает на сканер");
    load();
  };

  const free = items.filter((a) => !a.banned && !a.paused_until).length;

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center gap-2">
        <Icon name="Users" size={14} className="text-cyan-300" />
        <span className="text-xs text-white/70">
          Аккаунты сканера: {items.length} · свободно {free}
        </span>
        {!adding && (
          <button onClick={() => setAdding(true)}
            className="ml-auto rounded-lg px-3 py-1.5 text-xs border border-cyan-400/30 text-cyan-200 hover:bg-cyan-500/10 flex items-center gap-1.5">
            <Icon name="Plus" size={13} />Добавить аккаунт
          </button>
        )}
      </div>

      {adding && (
        <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
          <div className="text-xs text-white/60">
            {step === "phone" && "Введите номер Telegram-аккаунта — на него придёт код в приложении Telegram. Аккаунт «Только для бота» не участвует в сканировании и бережёт лимиты для поиска по запросам пользователей."}
            {step === "code" && (
              <>
                {VIA_TEXT[via] || "Код отправлен"} ({phone}).
                {via === "app" && " Откройте Telegram на телефоне или компьютере, где уже выполнен вход в этот аккаунт, — код придёт в чат «Telegram» с синей галочкой. СМС в этом случае не приходит."}
              </>
            )}
            {step === "password" && "На аккаунте включён облачный пароль (двухэтапная проверка) — введите его."}
          </div>
          {step === "phone" && (
            <div className="flex rounded-lg border border-white/10 p-1 w-fit">
              {([["scan", "Для сканера"], ["bot", "Только для бота"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setPurpose(k)}
                  className={`px-3 py-1 rounded-md text-xs ${purpose === k ? "bg-white/10 text-white" : "text-white/50 hover:text-white"}`}>
                  {l}
                </button>
              ))}
            </div>
          )}
          {step === "phone" && (
            <div className="flex flex-col sm:flex-row gap-2">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 999 123-45-67" className={inputCls} />
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Название (необязательно)" className={inputCls} />
            </div>
          )}
          {step === "code" && (
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Код из Telegram" inputMode="numeric" className={inputCls} autoFocus />
          )}
          {step === "code" && (
            <button onClick={resendCode} disabled={busy || !nextVia}
              className="text-xs text-cyan-300 hover:text-cyan-200 disabled:text-white/30 disabled:cursor-not-allowed underline underline-offset-2">
              {nextVia ? `Код не пришёл — ${NEXT_TEXT[nextVia] || "отправить другим способом"}` : "Другого способа отправки Telegram не предлагает"}
            </button>
          )}
          {step === "password" && (
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Облачный пароль" className={inputCls} autoFocus />
          )}
          <div className="flex gap-2">
            <button
              onClick={step === "phone" ? sendCode : signIn}
              disabled={busy || (step === "phone" ? !phone.trim() : step === "code" ? !code.trim() : !password)}
              className="grad-btn text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2 disabled:opacity-60"
            >
              {busy && <Icon name="Loader2" size={14} className="animate-spin" />}
              {step === "phone" ? "Получить код" : "Подключить"}
            </button>
            <button onClick={reset} className="rounded-lg px-4 py-2 text-sm border border-white/10 text-white/70 hover:bg-white/5">
              Отмена
            </button>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {items.map((a, i) => (
            <div key={`${a.id}-${i}`} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 flex items-center gap-2 min-w-0">
              <span className={`w-2 h-2 rounded-full shrink-0 ${a.banned ? "bg-red-400" : a.paused_until ? "bg-amber-400" : "bg-emerald-400"}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs text-white truncate">{a.label}</span>
                  {!a.main && (
                    <button onClick={() => togglePurpose(a)} title="Переключить назначение"
                      className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ${a.purpose === "bot" ? "bg-violet-500/20 text-violet-200" : "bg-cyan-500/15 text-cyan-200"}`}>
                      {a.purpose === "bot" ? "🤖 бот" : "сканер"}
                    </button>
                  )}
                </div>
                <div className="text-[11px] text-white/45 truncate">
                  {a.banned ? "заблокирован" : a.paused_until ? `пауза ещё ${pauseText(a.paused_until)}` : "готов к работе"}
                  {a.phone ? ` · ${a.phone}` : ""}
                </div>
              </div>
              <button
                onClick={() => logout(a)}
                disabled={outId === `${a.main ? "m" : a.id}`}
                className="shrink-0 rounded-md px-2 py-1 text-[11px] border border-white/10 text-white/60 hover:text-red-200 hover:border-red-400/40 hover:bg-red-500/10 flex items-center gap-1 disabled:opacity-60"
                title="Завершить сессию сканера в Telegram"
              >
                <Icon name={outId === `${a.main ? "m" : a.id}` ? "Loader2" : "LogOut"} size={12}
                  className={outId === `${a.main ? "m" : a.id}` ? "animate-spin" : ""} />
                Выйти
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
