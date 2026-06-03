import { useEffect, useState, useRef } from "react";
import { TG_ACCOUNTS_URL, INVITE_RUNNER_URL, TgAccount } from "./adminTypes";
import { useInviteProgress } from "./InviteProgressContext";
import { AccountsToolbar } from "./accounts/AccountsToolbar";
import { AccountRow } from "./accounts/AccountRow";
import { AccountLoginForm } from "./accounts/AccountLoginForm";

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
  const [targetGroup, setTargetGroup] = useState("");
  const [targetEdit, setTargetEdit] = useState("");
  const [targetSaving, setTargetSaving] = useState(false);
  const [runningAccountId, setRunningAccountId] = useState<number | null>(null);
  const stopRunRef = useRef(false);
  const { start: startProgress, stop: stopProgress, progress, refreshTrigger } = useInviteProgress();

  const headers = { "Content-Type": "application/json", "X-Admin-Token": token };

  async function load() {
    try {
      const r = await fetch(TG_ACCOUNTS_URL, { headers });
      const j = await r.json();
      setAccounts(j.accounts || []);
      if (j.target_group) {
        setTargetGroup(j.target_group);
        setTargetEdit(j.target_group);
      }
    } finally {
      setLoading(false);
    }
  }

  // Авто-обновление каждые 5 сек пока идёт инвайт + после завершения
  useEffect(() => {
    if (!progress?.active) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [progress?.active]);

  useEffect(() => {
    if (refreshTrigger > 0) load();
  }, [refreshTrigger]);

  async function saveTarget() {
    const v = targetEdit.trim();
    if (!v) { alert("Укажи ссылку или @username группы"); return; }
    setTargetSaving(true);
    try {
      const r = await fetch(`${TG_ACCOUNTS_URL}?action=set_target`, {
        method: "POST", headers, body: JSON.stringify({ target: v }),
      });
      const j = await r.json();
      if (j.ok) {
        setTargetGroup(j.target_group);
        setTargetEdit(j.target_group);
        alert(`Цель сохранена: ${j.target_group}`);
      } else {
        alert(j.error || "Ошибка");
      }
    } finally {
      setTargetSaving(false);
    }
  }

  async function checkTarget() {
    const v = targetEdit.trim() || targetGroup;
    if (!v) { alert("Сначала введи ссылку"); return; }
    setTargetSaving(true);
    try {
      const r = await fetch(`${TG_ACCOUNTS_URL}?action=check_target`, {
        method: "POST", headers, body: JSON.stringify({ target: v }),
      });
      const j = await r.json();
      const lines = [
        `Цель: ${v}`,
        j.title ? `Название: ${j.title}` : "",
        j.mode ? `Тип: ${j.mode}` : "",
        j.participants ? `Участников: ${j.participants}` : "",
        "",
        j.message || j.error || "",
      ].filter(Boolean).join("\n");
      alert(lines);
    } finally {
      setTargetSaving(false);
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

  async function unban(id: number) {
    await call("unban", { id });
  }

  async function resetDaily(id: number) {
    await call("reset_daily", { id });
  }

  async function unbanAll() {
    if (!confirm("Снять бан со ВСЕХ аккаунтов?")) return;
    await call("unban", { id: 0 });
  }

  async function resetDailyAll() {
    if (!confirm("Обнулить дневной счётчик у ВСЕХ аккаунтов?")) return;
    await call("reset_daily", { id: 0 });
  }

  async function distributeQueue() {
    if (!confirm("Разделить очередь кандидатов поровну между всеми рабочими аккаунтами?")) return;
    setBusy(true);
    try {
      const r = await fetch(`${INVITE_RUNNER_URL}?action=distribute_queue`, {
        method: "POST", headers, body: "{}",
      });
      const j = await r.json();
      if (j.ok) {
        const lines = (j.accounts || [])
          .map((a: { label: string; assigned: number }) => `${a.label}: ${a.assigned}`)
          .join("\n");
        alert(`Распределено: ${j.total_assigned || 0}\n\n${lines}`);
        await load();
      } else {
        alert(j.error || "Ошибка");
      }
    } finally {
      setBusy(false);
    }
  }

  async function runAccount(acc: TgAccount) {
    if (runningAccountId) {
      // Если уже идёт заливка — кнопка работает как «Стоп»
      stopRunRef.current = true;
      return;
    }
    if (!targetGroup) { alert("Сначала укажи целевую группу выше"); return; }
    if (!confirm(`Залить ВСЕХ кандидатов в ${targetGroup} с аккаунта «${acc.label}»?\n\nИдёт пачками по 20, можно остановить в любой момент.\nАккаунт должен быть участником группы.`)) return;
    stopRunRef.current = false;
    setRunningAccountId(acc.id);
    setBusy(true);
    startProgress({
      mode: "single_account",
      title: `Заливка всех с «${acc.label}»`,
      subtitle: targetGroup,
      estimatedSec: 60,
    });
    let totalAdded = 0, totalPrivacy = 0, totalFailed = 0;
    let banned = false;
    let emptyStreak = 0;
    let errStreak = 0;
    let sessionRetry = 0;
    try {
      while (!stopRunRef.current) {
        let j: {
          ok?: boolean; error?: string;
          added?: number; privacy?: number; failed?: number;
          ban_triggered?: boolean; peer_flood?: boolean;
        };
        try {
          const r = await fetch(`${INVITE_RUNNER_URL}?action=run_account`, {
            method: "POST", headers, body: JSON.stringify({ account_id: acc.id, size: 6 }),
          });
          j = await r.json();
        } catch {
          // Сетевой обрыв/таймаут одной пачки — не валим весь прогон, пробуем ещё раз
          errStreak++;
          if (errStreak >= 3) { alert("❌ Сеть недоступна, остановлено"); break; }
          await load();
          await new Promise((res) => setTimeout(res, 1500));
          continue;
        }
        errStreak = 0;
        if (!j.ok) {
          // «Сессия не отвечает» — временный сбой подключения к Telegram,
          // не валим весь прогон, даём несколько повторов.
          if ((j.error || "").includes("Сессия не отвечает")) {
            sessionRetry++;
            if (sessionRetry >= 4) { alert(`❌ ${j.error}`); break; }
            await new Promise((res) => setTimeout(res, 2000));
            continue;
          }
          alert(`❌ ${j.error || "Ошибка"}`); break;
        }
        sessionRetry = 0;
        totalAdded += j.added || 0;
        totalPrivacy += j.privacy || 0;
        totalFailed += j.failed || 0;
        await load();
        if (j.ban_triggered) { banned = true; break; }
        if (j.peer_flood) {
          // Telegram временно ограничил приглашения у аккаунта — даём отдохнуть, не баним.
          alert(`⏸️ «${acc.label}» упёрся в лимит приглашений Telegram.\n\nЭто НЕ бан — аккаунту нужно отдохнуть (час-два).\n\nДобавлено за прогон: ${totalAdded}\nЗапусти другой аккаунт или вернись к этому позже.`);
          break;
        }
        const processed = (j.added || 0) + (j.privacy || 0) + (j.failed || 0);
        // Если две пачки подряд пустые — кандидаты у аккаунта закончились
        if (processed === 0) { emptyStreak++; if (emptyStreak >= 2) break; }
        else emptyStreak = 0;
        await new Promise((res) => setTimeout(res, 600));
      }
      alert(`${banned ? "⚠️ Аккаунт получил БАН!\n\n" : stopRunRef.current ? "Остановлено.\n\n" : "✅ Готово!\n\n"}«${acc.label}»\nДобавлено: ${totalAdded}\nПриватность: ${totalPrivacy}\nОшибок: ${totalFailed}`);
    } finally {
      setRunningAccountId(null);
      stopRunRef.current = false;
      setBusy(false);
      stopProgress();
    }
  }

  async function rename(acc: TgAccount) {
    const next = prompt("Новое название:", acc.label);
    if (!next || next === acc.label) return;
    await call("update_label", { id: acc.id, label: next });
  }

  async function joinGroupOne(acc: TgAccount) {
    if (!targetGroup) { alert("Сначала укажи целевую группу выше"); return; }
    if (!confirm(`Аккаунт «${acc.label}» вступит в ${targetGroup}. Продолжить?`)) return;
    startProgress({
      mode: "join_group",
      title: `${acc.label} вступает в ${targetGroup}`,
      estimatedSec: 8,
    });
    try {
      const j = await call("join_group", { id: acc.id });
      if (j.ok) {
        const status = j.status === "already_in" ? "уже был в группе" : "успешно вступил";
        alert(`✅ ${acc.label}: ${status}`);
      } else {
        alert(`❌ ${acc.label}: ${j.error || "ошибка"}`);
      }
    } finally {
      stopProgress();
    }
  }

  async function joinGroupAll() {
    if (!targetGroup) { alert("Сначала укажи целевую группу выше"); return; }
    const active = accounts.filter(a => !a.is_banned);
    if (active.length === 0) { alert("Нет рабочих аккаунтов"); return; }
    if (!confirm(`Все ${active.length} аккаунта (-ов) вступят в ${targetGroup}.\nЗаймёт ~${active.length * 5} секунд. Продолжить?`)) return;
    startProgress({
      mode: "join_group",
      title: `${active.length} аккаунт(ов) вступают в ${targetGroup}`,
      estimatedSec: active.length * 6,
    });
    try {
      const j = await call("join_group", { all: true });
      if (j.results) {
        const ok = j.results.filter((r: { ok: boolean }) => r.ok).length;
        const fail = j.results.length - ok;
        const details = j.results.map((r: { label: string; ok: boolean; status?: string; error?: string }) =>
          `${r.ok ? "✅" : "❌"} ${r.label}: ${r.status || r.error}`
        ).join("\n");
        alert(`Готово: успех ${ok}, ошибок ${fail}\n\n${details}`);
      }
    } finally {
      stopProgress();
    }
  }

  return (
    <div className="glass rounded-2xl p-4 border border-white/5">
      <AccountsToolbar
        accounts={accounts}
        busy={busy}
        targetGroup={targetGroup}
        targetEdit={targetEdit}
        targetSaving={targetSaving}
        onTargetEdit={setTargetEdit}
        onCheckTarget={checkTarget}
        onSaveTarget={saveTarget}
        onUnbanAll={unbanAll}
        onResetDailyAll={resetDailyAll}
        onDistributeQueue={distributeQueue}
        onJoinGroupAll={joinGroupAll}
        onAddAccount={() => setStep("phone")}
        showActions={step === "idle"}
      />

      {loading ? (
        <div className="text-center py-6 text-xs text-muted-foreground">Загрузка...</div>
      ) : accounts.length === 0 && step === "idle" ? (
        <div className="text-center py-8 text-xs text-muted-foreground">
          Пока ни одного аккаунта. Нажми «Подключить», чтобы добавить первый.
        </div>
      ) : (
        <div className="border border-white/10 rounded-xl overflow-hidden mb-3 divide-y divide-white/5">
          {accounts.map(acc => (
            <AccountRow
              key={acc.id}
              acc={acc}
              busy={busy && runningAccountId !== acc.id}
              running={runningAccountId === acc.id}
              onJoinGroupOne={joinGroupOne}
              onActivate={activate}
              onResetDaily={resetDaily}
              onRename={rename}
              onMarkBanned={markBanned}
              onUnban={unban}
              onRemove={remove}
              onRunAccount={runAccount}
            />
          ))}
        </div>
      )}

      {step !== "idle" && (
        <AccountLoginForm
          step={step}
          phone={phone}
          code={code}
          pwd={pwd}
          label={label}
          busy={busy}
          err={err}
          onPhone={setPhone}
          onCode={setCode}
          onPwd={setPwd}
          onLabel={setLabel}
          onSendCode={sendCode}
          onVerifyCode={verifyCode}
          onVerify2fa={verify2fa}
          onCancel={resetForm}
        />
      )}
    </div>
  );
}

export default AdminAccountsManager;