import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { TG_ACCOUNTS_URL, TgAccount } from "./adminTypes";

type Step = "idle" | "phone" | "code" | "2fa";

export function AdminAccountsManager({ token }: { token: string }) {
  const [accounts, setAccounts] = useState<TgAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("idle");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [pwd, setPwd] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const headers = { "Content-Type": "application/json", "X-Admin-Token": token };

  async function load() {
    try {
      const r = await fetch(TG_ACCOUNTS_URL, { headers });
      const j = await r.json();
      setAccounts(j.accounts || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function call(action: string, body: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`${TG_ACCOUNTS_URL}?action=${action}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j.accounts) setAccounts(j.accounts);
      return j;
    } catch (e) {
      setErr(String(e));
      return { ok: false, error: String(e) };
    } finally {
      setBusy(false);
    }
  }

  async function sendCode() {
    if (!phone.trim()) { setErr("Введи номер телефона"); return; }
    const j = await call("send_code", { phone: phone.trim() });
    if (j.ok) setStep("code");
    else setErr(j.error || "Не удалось отправить код");
  }

  async function verifyCode() {
    if (!code.trim()) { setErr("Введи код"); return; }
    const j = await call("verify_code", { phone: phone.trim(), code: code.trim(), label: label.trim() });
    if (j.ok) { resetForm(); load(); }
    else if (j.need_2fa) setStep("2fa");
    else setErr(j.error || "Неверный код");
  }

  async function verify2fa() {
    if (!pwd) { setErr("Введи пароль 2FA"); return; }
    const j = await call("verify_2fa", { phone: phone.trim(), password: pwd, label: label.trim() });
    if (j.ok) { resetForm(); load(); }
    else setErr(j.error || "Неверный пароль");
  }

  function resetForm() {
    setStep("idle");
    setPhone(""); setCode(""); setPwd(""); setLabel("");
    setErr(null);
  }

  async function activate(id: number) {
    if (!confirm("Сделать этот аккаунт активным?")) return;
    await call("activate", { id });
  }

  async function remove(id: number) {
    if (!confirm("Удалить этот аккаунт из пула?")) return;
    await call("delete", { id });
  }

  async function markBanned(id: number) {
    if (!confirm("Пометить аккаунт как забаненный? Активным станет следующий доступный.")) return;
    await call("mark_banned", { id });
  }

  async function rename(acc: TgAccount) {
    const next = prompt("Новое название:", acc.label);
    if (!next || next === acc.label) return;
    await call("update_label", { id: acc.id, label: next });
  }

  async function joinGroupOne(acc: TgAccount) {
    if (!confirm(`Аккаунт «${acc.label}» вступит в @UG_DRIVER. Продолжить?`)) return;
    const j = await call("join_group", { id: acc.id });
    if (j.ok) {
      const status = j.status === "already_in" ? "уже был в группе" : "успешно вступил";
      alert(`✅ ${acc.label}: ${status}`);
    } else {
      alert(`❌ ${acc.label}: ${j.error || "ошибка"}`);
    }
  }

  async function joinGroupAll() {
    const active = accounts.filter(a => !a.is_banned);
    if (active.length === 0) { alert("Нет рабочих аккаунтов"); return; }
    if (!confirm(`Все ${active.length} аккаунта (-ов) вступят в @UG_DRIVER.\nЗаймёт ~${active.length * 5} секунд. Продолжить?`)) return;
    const j = await call("join_group", { all: true });
    if (j.results) {
      const ok = j.results.filter((r: { ok: boolean }) => r.ok).length;
      const fail = j.results.length - ok;
      const details = j.results.map((r: { label: string; ok: boolean; status?: string; error?: string }) =>
        `${r.ok ? "✅" : "❌"} ${r.label}: ${r.status || r.error}`
      ).join("\n");
      alert(`Готово: успех ${ok}, ошибок ${fail}\n\n${details}`);
    }
  }

  return (
    <div className="glass rounded-2xl p-5 border border-white/5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
          <Icon name="Users" size={20} />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold">Аккаунты для добавления</h3>
          <p className="text-xs text-muted-foreground">При бане одного — переключай на запасной</p>
        </div>
        {step === "idle" && (
          <div className="flex items-center gap-2">
            {accounts.filter(a => !a.is_banned).length > 0 && (
              <button
                onClick={joinGroupAll}
                disabled={busy}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs hover:bg-white/10 transition disabled:opacity-50"
                title="Все аккаунты вступят в @UG_DRIVER"
              >
                <Icon name="LogIn" size={14} />
                Все в @UG_DRIVER
              </button>
            )}
            <button
              onClick={() => setStep("phone")}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-sm hover:opacity-90 transition"
            >
              <Icon name="Plus" size={15} />
              Подключить
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-6 text-xs text-muted-foreground">Загрузка...</div>
      ) : accounts.length === 0 && step === "idle" ? (
        <div className="text-center py-8 text-xs text-muted-foreground">
          Пока ни одного аккаунта. Нажми «Подключить», чтобы добавить первый.
        </div>
      ) : (
        <div className="space-y-2 mb-3">
          {accounts.map(acc => (
            <div
              key={acc.id}
              className={`flex items-center gap-3 p-3 rounded-xl border ${
                acc.is_banned ? "border-red-500/40 bg-red-500/5" :
                acc.is_active ? "border-green-500/40 bg-green-500/5" :
                "border-white/10 bg-white/[0.02]"
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${
                acc.is_banned ? "bg-red-500" :
                acc.is_active ? "bg-green-500 shadow-lg shadow-green-500/50" :
                "bg-muted-foreground/30"
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{acc.label}</span>
                  {acc.is_active && !acc.is_banned && (
                    <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-green-500/20 text-green-300">активный</span>
                  )}
                  {acc.is_banned && (
                    <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">бан</span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {acc.phone || "—"} · сегодня: {acc.daily_invites_used}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!acc.is_banned && (
                  <button onClick={() => joinGroupOne(acc)} disabled={busy}
                    className="p-2 rounded-lg hover:bg-white/10 text-blue-400 transition" title="Вступить в @UG_DRIVER">
                    <Icon name="LogIn" size={14} />
                  </button>
                )}
                {!acc.is_active && !acc.is_banned && (
                  <button onClick={() => activate(acc.id)} disabled={busy}
                    className="p-2 rounded-lg hover:bg-white/10 text-green-400 transition" title="Сделать активным">
                    <Icon name="Power" size={14} />
                  </button>
                )}
                <button onClick={() => rename(acc)} disabled={busy}
                  className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground transition" title="Переименовать">
                  <Icon name="Pencil" size={14} />
                </button>
                {!acc.is_banned && (
                  <button onClick={() => markBanned(acc.id)} disabled={busy}
                    className="p-2 rounded-lg hover:bg-white/10 text-amber-400 transition" title="Пометить забаненным">
                    <Icon name="Ban" size={14} />
                  </button>
                )}
                <button onClick={() => remove(acc.id)} disabled={busy}
                  className="p-2 rounded-lg hover:bg-white/10 text-red-400 transition" title="Удалить">
                  <Icon name="Trash2" size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {step !== "idle" && (
        <div className="border border-white/10 rounded-xl p-4 bg-white/[0.02] space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">
              {step === "phone" && "Шаг 1: номер телефона"}
              {step === "code" && "Шаг 2: код из Telegram"}
              {step === "2fa" && "Шаг 3: пароль 2FA"}
            </div>
            <button onClick={resetForm} className="text-xs text-muted-foreground hover:text-white">
              Отмена
            </button>
          </div>

          {step === "phone" && (
            <>
              <input
                type="tel" placeholder="+79991234567" value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
              <input
                type="text" placeholder="Название (например: Запасной 1) — опционально" value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
              <button onClick={sendCode} disabled={busy}
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
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 tracking-widest text-center font-mono"
              />
              <button onClick={verifyCode} disabled={busy}
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
                onChange={(e) => setPwd(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
              <button onClick={verify2fa} disabled={busy}
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
      )}
    </div>
  );
}