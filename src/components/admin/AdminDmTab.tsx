import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { DM_SENDER_URL } from "./adminTypes";

interface DmAccount {
  id: number;
  label: string;
  is_banned: boolean;
  is_active: boolean;
  pending: number;
}
interface DmCounts {
  pending: number; sent: number; privacy: number; failed: number; in_progress: number; total: number;
}
interface RunResult {
  ok?: boolean; error?: string; session_dead?: boolean;
  sent?: number; privacy?: number; failed?: number; peer_flood?: boolean; empty?: boolean;
}

export function AdminDmTab({ token }: { token: string }) {
  const [accounts, setAccounts] = useState<DmAccount[]>([]);
  const [counts, setCounts] = useState<DmCounts | null>(null);
  const [text, setText] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
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

  const headers = { "Content-Type": "application/json", "X-Admin-Token": token };

  async function load() {
    try {
      const r = await fetch(DM_SENDER_URL, { headers });
      const j = await r.json();
      setAccounts(j.accounts || []);
      setCounts(j.counts || null);
      if (j.click_total) setClickTotal(j.click_total);
      if (j.run_max) setRunMax(j.run_max);
      if (j.message) {
        setText(j.message.text || "");
        setPhotoUrl(j.message.photo_url || "");
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
        body: JSON.stringify({ text, photo_base64: b64, photo_ext: ext }),
      });
      const j = await r.json();
      if (j.ok) setPhotoUrl(j.message.photo_url || "");
      setSaving(false);
    };
    reader.readAsDataURL(file);
  }

  async function saveTemplate() {
    setSaving(true);
    await fetch(`${DM_SENDER_URL}?action=save_message`, {
      method: "POST", headers, body: JSON.stringify({ text, photo_url: photoUrl }),
    });
    setSaving(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  }

  async function removePhoto() {
    setSaving(true);
    await fetch(`${DM_SENDER_URL}?action=save_message`, {
      method: "POST", headers, body: JSON.stringify({ text, remove_photo: true }),
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
  async function sendOnce(acc: DmAccount): Promise<{ sent: number; privacy: number; failed: number; stopped: boolean }> {
    let totalSent = 0, totalPrivacy = 0, totalFailed = 0, emptyStreak = 0, stopped = false;
    while (!stopRef.current) {
      const done = totalSent + totalPrivacy + totalFailed;
      if (done >= clickTotal) break;
      setRunLog(`«${acc.label}»: ${done} из ${clickTotal}...`);
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
      await load();
      if (j.peer_flood) {
        alert(`⏸️ «${acc.label}» упёрся в лимит Telegram — аккаунту нужно отдохнуть.\nОтправлено: ${totalSent}`);
        stopped = true; break;
      }
      const processed = (j.sent || 0) + (j.privacy || 0) + (j.failed || 0);
      if (processed === 0) { emptyStreak++; if (emptyStreak >= 2) break; } else emptyStreak = 0;
      await new Promise(res => setTimeout(res, 500));
    }
    return { sent: totalSent, privacy: totalPrivacy, failed: totalFailed, stopped };
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
      alert(`${res.stopped ? "" : "✅ Готово!\n\n"}«${acc.label}»\nОтправлено: ${res.sent}\nПриватность: ${res.privacy}\nОшибок: ${res.failed}`);
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
    let gs = 0, gp = 0, gf = 0;
    try {
      for (const acc of chosen) {
        if (stopRef.current) break;
        setRunningId(acc.id);
        const res = await sendOnce(acc);
        gs += res.sent; gp += res.privacy; gf += res.failed;
        if (res.stopped && stopRef.current) break;
        await new Promise(res => setTimeout(res, 600));
      }
      alert(`${stopRef.current ? "Остановлено.\n\n" : "✅ Рассылка по выбранным завершена!\n\n"}Отправлено: ${gs}\nПриватность: ${gp}\nОшибок: ${gf}`);
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
      <div className="glass rounded-xl p-3 border border-white/5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shrink-0">
          <Icon name="Mail" size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold">Рассылка в личку</h2>
          <p className="text-[11px] text-muted-foreground">Текст + фото · по {clickTotal} сообщений за нажатие — чтобы не получить бан</p>
        </div>
      </div>

      {counts && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Ожидают", val: counts.pending, color: "text-amber-300" },
            { label: "Отправлено", val: counts.sent, color: "text-green-400" },
            { label: "Приватность", val: counts.privacy, color: "text-blue-300" },
            { label: "Ошибки", val: counts.failed, color: "text-red-400" },
          ].map(c => (
            <div key={c.label} className="glass rounded-xl p-3 border border-white/5 text-center">
              <div className={`text-lg font-bold ${c.color}`}>{c.val}</div>
              <div className="text-[10px] text-muted-foreground">{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Форма сообщения */}
      <div className="glass rounded-xl p-4 border border-white/5 space-y-3">
        <div className="text-xs font-semibold text-muted-foreground">Текст сообщения (общий для всех)</div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={5}
          placeholder="Напиши текст рассылки..."
          className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm resize-y outline-none focus:border-blue-400/50"
        />

        <div className="flex items-center gap-3">
          {photoUrl ? (
            <div className="relative">
              <img src={photoUrl} alt="" className="w-20 h-20 object-cover rounded-lg border border-white/10" />
              <button onClick={removePhoto}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center">
                <Icon name="X" size={12} />
              </button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} disabled={saving}
              className="w-20 h-20 rounded-lg border border-dashed border-white/20 flex flex-col items-center justify-center text-muted-foreground hover:border-blue-400/50 transition disabled:opacity-50">
              <Icon name="ImagePlus" size={20} />
              <span className="text-[9px] mt-1">Фото</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
          <div className="text-[11px] text-muted-foreground flex-1">Одно фото с подписью.</div>
          <Button onClick={saveTemplate} disabled={saving} size="sm"
            className={`gap-1 shrink-0 ${savedFlash ? "bg-green-600 hover:bg-green-600" : "grad-btn"}`}>
            <Icon name={savedFlash ? "Check" : "Save"} size={14} />
            {saving ? "Сохраняю..." : savedFlash ? "Сохранено" : "Сохранить шаблон"}
          </Button>
        </div>

        {/* Предпросмотр — как увидит получатель */}
        <div>
          <div className="text-[11px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
            <Icon name="Eye" size={12} /> Предпросмотр
          </div>
          <div className="bg-[#0e1621] rounded-xl p-3 flex justify-start">
            <div className="max-w-[280px] bg-[#182533] rounded-2xl rounded-bl-md overflow-hidden shadow-lg">
              {photoUrl && <img src={photoUrl} alt="" className="w-full max-h-52 object-cover" />}
              <div className="px-3 py-2">
                {text ? (
                  <div className="text-[13px] text-white/90 whitespace-pre-wrap break-words leading-snug">{text}</div>
                ) : (
                  <div className="text-[13px] text-white/30 italic">Текст сообщения...</div>
                )}
                <div className="text-[10px] text-white/40 text-right mt-1">12:00</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Управление очередью + выбор аккаунтов */}
      <div className="glass rounded-xl p-4 border border-white/5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-xs font-semibold">Получатели: <span className="text-amber-300">{pendingTotal}</span> в очереди</div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={seed} disabled={busy} className="gap-1 text-xs">
              <Icon name="Download" size={13} />Заполнить из инвайтов
            </Button>
            <Button size="sm" variant="outline" onClick={clearQueue} disabled={busy} className="gap-1 text-xs text-red-300">
              <Icon name="Trash2" size={13} />Очистить
            </Button>
          </div>
        </div>

        {/* Выбрать все */}
        {liveAccounts.length > 0 && (
          <button onClick={toggleSelectAll}
            className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-white transition">
            <span className={`w-4 h-4 rounded border flex items-center justify-center ${allSelected ? "bg-blue-600 border-blue-600" : "border-white/30"}`}>
              {allSelected && <Icon name="Check" size={11} />}
            </span>
            Выбрать все аккаунты
          </button>
        )}

        <div className="border border-white/10 rounded-xl overflow-hidden divide-y divide-white/5">
          {accounts.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground">Нет подключённых аккаунтов</div>
          ) : accounts.map(a => {
            const isRunning = runningId === a.id;
            const isChecked = selected.has(a.id);
            return (
              <div key={a.id} className={`flex items-center gap-2 px-3 py-2 text-sm ${a.is_banned ? "bg-red-500/5" : isRunning ? "bg-blue-500/10" : ""}`}>
                {!a.is_banned && (
                  <button onClick={() => toggleSelect(a.id)}
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isChecked ? "bg-blue-600 border-blue-600" : "border-white/30 hover:border-blue-400"}`}>
                    {isChecked && <Icon name="Check" size={11} />}
                  </button>
                )}
                <span className={`w-2 h-2 rounded-full shrink-0 ${a.is_banned ? "bg-red-500" : a.is_active ? "bg-green-500" : "bg-white/30"}`} />
                <span className="flex-1 truncate">{a.label}</span>
                {a.is_banned && <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">бан</span>}
                <span className="text-xs text-muted-foreground shrink-0 mr-1">{a.pending} получат.</span>
                {!a.is_banned && (
                  <button
                    onClick={() => runAccount(a)}
                    disabled={busy && !isRunning}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-white text-[11px] font-semibold shrink-0 transition hover:opacity-90 disabled:opacity-40 ${isRunning ? "bg-red-500/80" : "bg-gradient-to-r from-blue-600 to-cyan-600"}`}
                    title={isRunning ? "Остановить" : `Отправить ${clickTotal} сообщений с этого аккаунта`}
                  >
                    <Icon name={isRunning ? "Square" : "Send"} size={12} className={isRunning ? "animate-pulse" : ""} />
                    {isRunning ? "Стоп" : "Отправить"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {runningId && runLog && (
          <div className="text-[11px] text-blue-300 animate-pulse">{runLog}</div>
        )}

        {selected.size > 0 && (
          <Button onClick={runSelected} disabled={busy && !runningId}
            className={`w-full gap-2 ${runningId ? "bg-red-500/80 hover:bg-red-500" : "grad-btn"}`}>
            <Icon name={runningId ? "Square" : "Send"} size={16} />
            {runningId ? "Остановить рассылку" : `Отправить с выбранных (${selected.size})`}
          </Button>
        )}
      </div>
    </div>
  );
}

export default AdminDmTab;
