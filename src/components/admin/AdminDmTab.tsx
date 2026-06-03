import { useEffect, useRef, useState } from "react";
import { DM_SENDER_URL, TG_ACCOUNTS_URL } from "./adminTypes";
import { DmAccount, DmCounts, RunResult, LoginStep } from "./dm/dmTypes";
import { DmHeader } from "./dm/DmHeader";
import { DmMessageForm } from "./dm/DmMessageForm";
import { DmQueuePanel } from "./dm/DmQueuePanel";

export function AdminDmTab({ token }: { token: string }) {
  const [accounts, setAccounts] = useState<DmAccount[]>([]);
  const [counts, setCounts] = useState<DmCounts | null>(null);
  const [text, setText] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [busy, setBusy] = useState(false);
  const [runningId, setRunningId] = useState<number | null>(null);
  const [runLog, setRunLog] = useState<string>("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [clickTotal, setClickTotal] = useState(20);
  const [runMax, setRunMax] = useState(7);
  const stopRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Добавление нового аккаунта (вход по номеру)
  const [loginStep, setLoginStep] = useState<LoginStep>("idle");
  const [loginPhone, setLoginPhone] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [loginPwd, setLoginPwd] = useState("");
  const [loginLabel, setLoginLabel] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginErr, setLoginErr] = useState<string | null>(null);

  async function loginCall(action: string, body: Record<string, unknown>) {
    setLoginBusy(true);
    setLoginErr(null);
    try {
      const r = await fetch(`${TG_ACCOUNTS_URL}?action=${action}`, {
        method: "POST", headers, body: JSON.stringify(body),
      });
      return await r.json();
    } catch (e) {
      return { ok: false, error: String(e) };
    } finally {
      setLoginBusy(false);
    }
  }

  function resetLogin() {
    setLoginStep("idle");
    setLoginPhone(""); setLoginCode(""); setLoginPwd(""); setLoginLabel("");
    setLoginErr(null);
  }

  async function loginSendCode() {
    if (!loginPhone.trim()) { setLoginErr("Введи номер телефона"); return; }
    const j = await loginCall("send_code", { phone: loginPhone.trim() });
    if (j.ok) setLoginStep("code");
    else setLoginErr(j.error || "Не удалось отправить код");
  }

  async function redistribute(silent = false) {
    const r = await fetch(`${DM_SENDER_URL}?action=redistribute`, { method: "POST", headers, body: "{}" });
    const j = await r.json();
    await load();
    if (!silent && j.ok) {
      alert(`Очередь распределена между ${j.accounts} аккаунтами.\nВсего получателей: ${j.assigned}`);
    }
    return j;
  }

  async function loginVerifyCode() {
    if (!loginCode.trim()) { setLoginErr("Введи код"); return; }
    const j = await loginCall("verify_code", { phone: loginPhone.trim(), code: loginCode.trim(), label: loginLabel.trim() });
    if (j.ok) { resetLogin(); await redistribute(true); }
    else if (j.need_2fa) setLoginStep("2fa");
    else setLoginErr(j.error || "Неверный код");
  }

  async function loginVerify2fa() {
    if (!loginPwd) { setLoginErr("Введи пароль 2FA"); return; }
    const j = await loginCall("verify_2fa", { phone: loginPhone.trim(), password: loginPwd, label: loginLabel.trim() });
    if (j.ok) { resetLogin(); await redistribute(true); }
    else setLoginErr(j.error || "Неверный пароль");
  }

  const headers = { "Content-Type": "application/json", "X-Admin-Token": token };

  async function load() {
    try {
      const r = await fetch(DM_SENDER_URL, { headers });
      const j = await r.json();
      setAccounts(j.accounts || []);
      setCounts(j.counts || null);
      if (j.run_max) setRunMax(j.run_max);
      if (j.message) {
        setText(j.message.text || "");
        setPhotoUrl(j.message.photo_url || "");
        setButtonText(j.message.button_text || "");
        setButtonUrl(j.message.button_url || "");
      }
    } catch { /* ignore */ }
  }

  useEffect(() => { load(); }, []);

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = String(reader.result).split(",")[1];
      const ext = file.name.split(".").pop()?.toLowerCase() === "png" ? "png" : "jpg";
      const r = await fetch(`${DM_SENDER_URL}?action=save_message`, {
        method: "POST", headers,
        body: JSON.stringify({ text, photo_base64: b64, photo_ext: ext, button_text: buttonText, button_url: buttonUrl }),
      });
      const j = await r.json();
      if (j.ok) setPhotoUrl(j.message.photo_url || "");
      setSaving(false);
    };
    reader.readAsDataURL(file);
  }

  async function saveTemplate() {
    if (buttonUrl && !/^https?:\/\//i.test(buttonUrl)) {
      alert("Ссылка кнопки должна начинаться с http:// или https://");
      return;
    }
    setSaving(true);
    await fetch(`${DM_SENDER_URL}?action=save_message`, {
      method: "POST", headers,
      body: JSON.stringify({ text, photo_url: photoUrl, button_text: buttonText, button_url: buttonUrl }),
    });
    setSaving(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  }

  async function removePhoto() {
    setSaving(true);
    await fetch(`${DM_SENDER_URL}?action=save_message`, {
      method: "POST", headers,
      body: JSON.stringify({ text, remove_photo: true, button_text: buttonText, button_url: buttonUrl }),
    });
    setPhotoUrl("");
    setSaving(false);
  }

  async function seed() {
    if (!confirm("Заполнить список получателей из раздела «Авто-приглашения»?")) return;
    setBusy(true);
    const r = await fetch(`${DM_SENDER_URL}?action=seed`, { method: "POST", headers });
    const j = await r.json();
    setBusy(false);
    await load();
    alert(`Добавлено получателей: ${j.inserted || 0}`);
  }

  async function clearQueue() {
    if (!confirm("Очистить весь список получателей рассылки?")) return;
    setBusy(true);
    await fetch(`${DM_SENDER_URL}?action=clear`, { method: "POST", headers });
    setBusy(false);
    await load();
  }

  async function cleanInvalid() {
    if (!confirm("Убрать из очереди получателей без корректного юзернейма?")) return;
    setBusy(true);
    const r = await fetch(`${DM_SENDER_URL}?action=clean_invalid`, { method: "POST", headers });
    const j = await r.json();
    setBusy(false);
    await load();
    alert(`Убрано без юзернейма: ${j.deleted || 0}`);
  }

  function toggleSelect(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const live = accounts.filter(a => !a.is_banned).map(a => a.id);
    setSelected(prev => prev.size === live.length ? new Set() : new Set(live));
  }

  // Один прогон по аккаунту: ровно clickTotal сообщений, мини-пачками по runMax.
  // Возвращает true если можно продолжать (не стоп/не критическая ошибка).
  async function sendOnce(acc: DmAccount): Promise<{ sent: number; privacy: number; failed: number; removed: number; stopped: boolean; flooded: boolean }> {
    let totalSent = 0, totalPrivacy = 0, totalFailed = 0, totalRemoved = 0, emptyStreak = 0, stopped = false, flooded = false;
    while (!stopRef.current) {
      const done = totalSent + totalPrivacy + totalFailed + totalRemoved;
      if (done >= clickTotal) break;
      setRunLog(`«${acc.label}»: ${totalSent} отправлено из ${clickTotal}...`);
      let j: RunResult;
      try {
        const r = await fetch(`${DM_SENDER_URL}?action=run_account`, {
          method: "POST", headers,
          body: JSON.stringify({ account_id: acc.id, size: Math.min(clickTotal - done, runMax) }),
        });
        j = await r.json();
      } catch {
        await new Promise(res => setTimeout(res, 1500));
        continue;
      }
      if (!j.ok) {
        if (j.session_dead) alert(`🔌 ${j.error}`);
        else alert(`⚠️ «${acc.label}»: ${j.error || "ошибка"}`);
        stopped = true; break;
      }
      totalSent += j.sent || 0;
      totalPrivacy += j.privacy || 0;
      totalFailed += j.failed || 0;
      totalRemoved += j.removed || 0;
      await load();
      if (j.peer_flood) {
        // Лимит Telegram — без попапа и без остановки всей рассылки:
        // просто завершаем этот аккаунт и переходим к следующему.
        flooded = true;
        break;
      }
      const processed = (j.sent || 0) + (j.privacy || 0) + (j.failed || 0) + (j.removed || 0);
      if (processed === 0) { emptyStreak++; if (emptyStreak >= 2) break; } else emptyStreak = 0;
      await new Promise(res => setTimeout(res, 500));
    }
    return { sent: totalSent, privacy: totalPrivacy, failed: totalFailed, removed: totalRemoved, stopped, flooded };
  }

  async function runAccount(acc: DmAccount) {
    if (runningId === acc.id) { stopRef.current = true; return; }
    if (runningId) { alert("Дождись окончания текущей рассылки или останови её"); return; }
    if (!text && !photoUrl) { alert("Сначала заполни текст или фото рассылки"); return; }
    if (acc.is_banned) { alert("Этот аккаунт помечен забаненным"); return; }
    if (acc.pending === 0) { alert(`У «${acc.label}» нет получателей в очереди`); return; }
    if (!confirm(`Отправить ${clickTotal} сообщений с аккаунта «${acc.label}»?\n\nЗа одно нажатие уходит ${clickTotal} сообщений — чтобы не получить бан.`)) return;

    stopRef.current = false;
    setRunningId(acc.id);
    setBusy(true);
    try {
      const res = await sendOnce(acc);
      const floodNote = res.flooded && res.sent === 0
        ? "\n\n⏸️ Аккаунт упёрся в лимит Telegram — ему нужен прогрев/отдых."
        : res.flooded ? "\n\n⏸️ Под конец упёрся в лимит Telegram." : "";
      alert(`${res.stopped ? "" : "✅ Готово!\n\n"}«${acc.label}»\nОтправлено: ${res.sent}\nПриватность: ${res.privacy}\nОшибок: ${res.failed}\nУдалено несуществующих: ${res.removed}${floodNote}`);
    } finally {
      setRunningId(null);
      setBusy(false);
      stopRef.current = false;
      setRunLog("");
      await load();
    }
  }

  async function runSelected() {
    if (runningId) { stopRef.current = true; return; }
    if (!text && !photoUrl) { alert("Сначала заполни текст или фото рассылки"); return; }
    const chosen = accounts.filter(a => selected.has(a.id) && !a.is_banned && a.pending > 0);
    if (chosen.length === 0) { alert("Отметь хотя бы один аккаунт с получателями"); return; }
    if (!confirm(`Отправить по ${clickTotal} сообщений с ${chosen.length} аккаунт(ов)?\n\nКаждый отправит ${clickTotal} штук по очереди.`)) return;

    stopRef.current = false;
    setBusy(true);
    let gs = 0, gp = 0, gf = 0, gr = 0;
    const floodedAccounts: string[] = [];
    try {
      for (const acc of chosen) {
        if (stopRef.current) break;
        setRunningId(acc.id);
        const res = await sendOnce(acc);
        gs += res.sent; gp += res.privacy; gf += res.failed; gr += res.removed;
        if (res.flooded) floodedAccounts.push(acc.label);
        if (res.stopped && stopRef.current) break;
        await new Promise(res => setTimeout(res, 600));
      }
      const floodNote = floodedAccounts.length
        ? `\n\n⏸️ Упёрлись в лимит Telegram (нужен прогрев/отдых): ${floodedAccounts.join(", ")}`
        : "";
      alert(`${stopRef.current ? "Остановлено.\n\n" : "✅ Рассылка по выбранным завершена!\n\n"}Отправлено: ${gs}\nПриватность: ${gp}\nОшибок: ${gf}\nУдалено несуществующих: ${gr}${floodNote}`);
    } finally {
      setRunningId(null);
      setBusy(false);
      stopRef.current = false;
      setRunLog("");
      await load();
    }
  }

  const pendingTotal = accounts.reduce((s, a) => s + a.pending, 0);
  const liveAccounts = accounts.filter(a => !a.is_banned);
  const allSelected = liveAccounts.length > 0 && selected.size === liveAccounts.length;

  return (
    <div className="space-y-4">
      <DmHeader
        clickTotal={clickTotal}
        setClickTotal={setClickTotal}
        runningId={runningId}
        counts={counts}
      />

      <DmMessageForm
        text={text}
        setText={setText}
        photoUrl={photoUrl}
        buttonText={buttonText}
        setButtonText={setButtonText}
        buttonUrl={buttonUrl}
        setButtonUrl={setButtonUrl}
        saving={saving}
        savedFlash={savedFlash}
        fileRef={fileRef}
        onPickPhoto={onPickPhoto}
        saveTemplate={saveTemplate}
        removePhoto={removePhoto}
      />

      <DmQueuePanel
        pendingTotal={pendingTotal}
        busy={busy}
        accounts={accounts}
        liveAccounts={liveAccounts}
        allSelected={allSelected}
        selected={selected}
        runningId={runningId}
        runLog={runLog}
        clickTotal={clickTotal}
        loginStep={loginStep}
        setLoginStep={setLoginStep}
        resetLogin={resetLogin}
        seed={seed}
        redistribute={redistribute}
        cleanInvalid={cleanInvalid}
        clearQueue={clearQueue}
        loginPhone={loginPhone}
        loginCode={loginCode}
        loginPwd={loginPwd}
        loginLabel={loginLabel}
        loginBusy={loginBusy}
        loginErr={loginErr}
        setLoginPhone={setLoginPhone}
        setLoginCode={setLoginCode}
        setLoginPwd={setLoginPwd}
        setLoginLabel={setLoginLabel}
        loginSendCode={loginSendCode}
        loginVerifyCode={loginVerifyCode}
        loginVerify2fa={loginVerify2fa}
        toggleSelect={toggleSelect}
        toggleSelectAll={toggleSelectAll}
        runAccount={runAccount}
        runSelected={runSelected}
      />
    </div>
  );
}

export default AdminDmTab;