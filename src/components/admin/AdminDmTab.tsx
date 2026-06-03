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
interface DmMessage { text: string; photo_url: string; }

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
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [runLog, setRunLog] = useState<string>("");
  const stopRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const headers = { "Content-Type": "application/json", "X-Admin-Token": token };

  async function load() {
    try {
      const r = await fetch(DM_SENDER_URL, { headers });
      const j = await r.json();
      setAccounts(j.accounts || []);
      setCounts(j.counts || null);
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

  async function saveText() {
    setSaving(true);
    await fetch(`${DM_SENDER_URL}?action=save_message`, {
      method: "POST", headers, body: JSON.stringify({ text, photo_url: photoUrl }),
    });
    setSaving(false);
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

  async function runAll() {
    if (running) { stopRef.current = true; return; }
    if (!text && !photoUrl) { alert("Сначала заполни текст или фото рассылки"); return; }
    const pendingTotal = accounts.reduce((s, a) => s + a.pending, 0);
    if (pendingTotal === 0) { alert("Список получателей пуст. Нажми «Заполнить из инвайтов»."); return; }
    if (!confirm(`Запустить рассылку в личку со всех аккаунтов?\nПолучателей в очереди: ${pendingTotal}\n\nИдёт пачками, можно остановить.`)) return;

    stopRef.current = false;
    setRunning(true);
    setBusy(true);
    let totalSent = 0, totalPrivacy = 0, totalFailed = 0;
    const live = accounts.filter(a => !a.is_banned);

    try {
      // По кругу обходим аккаунты, пока есть кого слать и не нажали «Стоп»
      let anyWork = true;
      while (anyWork && !stopRef.current) {
        anyWork = false;
        for (const acc of live) {
          if (stopRef.current) break;
          setRunLog(`Отправляю с «${acc.label}»...`);
          let j: RunResult;
          try {
            const r = await fetch(`${DM_SENDER_URL}?action=run_account`, {
              method: "POST", headers, body: JSON.stringify({ account_id: acc.id, size: 6 }),
            });
            j = await r.json();
          } catch {
            await new Promise(res => setTimeout(res, 1500));
            continue;
          }
          if (!j.ok) {
            if (j.session_dead) { setRunLog(`🔌 ${j.error}`); continue; }
            setRunLog(`⚠️ «${acc.label}»: ${j.error || "ошибка"}`);
            continue;
          }
          totalSent += j.sent || 0;
          totalPrivacy += j.privacy || 0;
          totalFailed += j.failed || 0;
          await load();
          if (j.peer_flood) { setRunLog(`⏸️ «${acc.label}» упёрся в лимит Telegram — отдыхает`); continue; }
          const processed = (j.sent || 0) + (j.privacy || 0) + (j.failed || 0);
          if (processed > 0) anyWork = true;
          await new Promise(res => setTimeout(res, 500));
        }
      }
      alert(`${stopRef.current ? "Остановлено.\n\n" : "✅ Рассылка завершена!\n\n"}Отправлено: ${totalSent}\nНельзя писать (приватность): ${totalPrivacy}\nОшибок: ${totalFailed}`);
    } finally {
      setRunning(false);
      setBusy(false);
      stopRef.current = false;
      setRunLog("");
      await load();
    }
  }

  const pendingTotal = accounts.reduce((s, a) => s + a.pending, 0);

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-3 border border-white/5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shrink-0">
          <Icon name="Mail" size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold">Рассылка в личку</h2>
          <p className="text-[11px] text-muted-foreground">Текст + фото · отправка с каждого аккаунта своим получателям</p>
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
          onBlur={saveText}
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
          <div className="text-[11px] text-muted-foreground">
            {saving ? "Сохраняю..." : "Одно фото с подписью. Изменения сохраняются автоматически."}
          </div>
        </div>
      </div>

      {/* Управление очередью */}
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

        <div className="border border-white/10 rounded-xl overflow-hidden divide-y divide-white/5">
          {accounts.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground">Нет подключённых аккаунтов</div>
          ) : accounts.map(a => (
            <div key={a.id} className={`flex items-center gap-2 px-3 py-2 text-sm ${a.is_banned ? "bg-red-500/5" : ""}`}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${a.is_banned ? "bg-red-500" : a.is_active ? "bg-green-500" : "bg-white/30"}`} />
              <span className="flex-1 truncate">{a.label}</span>
              {a.is_banned && <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">бан</span>}
              <span className="text-xs text-muted-foreground shrink-0">{a.pending} получат.</span>
            </div>
          ))}
        </div>

        {running && runLog && (
          <div className="text-[11px] text-blue-300 animate-pulse">{runLog}</div>
        )}

        <Button onClick={runAll} disabled={busy && !running}
          className={`w-full gap-2 ${running ? "bg-red-500/80 hover:bg-red-500" : "grad-btn"}`}>
          <Icon name={running ? "Square" : "Send"} size={16} />
          {running ? "Остановить рассылку" : "Запустить рассылку со всех аккаунтов"}
        </Button>
      </div>
    </div>
  );
}

export default AdminDmTab;
