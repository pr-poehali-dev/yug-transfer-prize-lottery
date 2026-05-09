import { useState, useEffect } from "react";
import { toast } from "sonner";
import Icon from "@/components/ui/icon";
import { EXCLUDED_WATCHER_URL, TG_USER_AUTH2_URL } from "./adminTypes";
import { TgUserLogin } from "./TgUserLogin";
import {
  type Settings,
  type HistoryItem,
  type ResendItem,
  type ResendQueueStatus,
  fmtAgo,
} from "./excluded/excludedTypes";
import { ExcludedTabHeader } from "./excluded/ExcludedTabHeader";
import { ExcludedSettingsCard } from "./excluded/ExcludedSettingsCard";
import { ExcludedHistoryCard } from "./excluded/ExcludedHistoryCard";

interface Props { token: string; }

export function AdminExcludedTab({ token }: Props) {
  const [tabExpanded, setTabExpanded] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [template, setTemplate] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runResult, setRunResult] = useState<string>("");
  const [reviving, setReviving] = useState(false);
  const [resending, setResending] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(false);
  const [resendQueue, setResendQueue] = useState<ResendQueueStatus | null>(null);
  const [scanning, setScanning] = useState(false);
  const [resendList, setResendList] = useState<ResendItem[] | null>(null);
  const [sendingOneId, setSendingOneId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [, setNowTick] = useState(0);

  const headers = { "Content-Type": "application/json", "X-Admin-Token": token };

  const load = async () => {
    const r = await fetch(EXCLUDED_WATCHER_URL, { headers: { "X-Admin-Token": token } });
    const d = await r.json();
    setSettings(d);
    setTemplate(d.message_template || "");
    setEnabled(!!d.enabled);
    setLastUpdated(Date.now());
  };

  const loadHistory = async () => {
    const r = await fetch(`${EXCLUDED_WATCHER_URL}?action=history`, { headers: { "X-Admin-Token": token } });
    const d = await r.json();
    setHistory(d.items || []);
  };

  const refreshNow = async () => {
    setRefreshing(true);
    try { await Promise.all([load(), loadHistory()]); }
    finally { setRefreshing(false); }
  };

  useEffect(() => {
    if (!tabExpanded) return;
    const id = setInterval(() => setNowTick(t => t + 1), 10_000);
    return () => clearInterval(id);
  }, [tabExpanded]);

  useEffect(() => {
    if (tabExpanded) { load(); loadHistory(); }
  }, [tabExpanded]);

  useEffect(() => {
    if (!tabExpanded) return;
    const idStatus = setInterval(() => { load(); }, 60_000);
    const idHistory = setInterval(() => { loadHistory(); }, 180_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') { load(); loadHistory(); }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(idStatus);
      clearInterval(idHistory);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [tabExpanded]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await fetch(`${EXCLUDED_WATCHER_URL}?action=settings`, {
        method: "POST", headers,
        body: JSON.stringify({ enabled, message_template: template }),
      });
      await load();
    } finally { setSaving(false); }
  };

  const togglePower = async (on: boolean) => {
    if (saving) return;
    if (!on && !confirm("Выключить авто-сообщения исключённым?\n\nФоновый слушатель остановится — экономия compute_seconds до конца месяца.")) return;
    setSaving(true);
    try {
      setEnabled(on);
      await fetch(`${EXCLUDED_WATCHER_URL}?action=settings`, {
        method: "POST", headers,
        body: JSON.stringify({ enabled: on, message_template: template }),
      });
      await load();
    } finally { setSaving(false); }
  };

  const loadResendQueue = async () => {
    try {
      const r = await fetch(`${EXCLUDED_WATCHER_URL}?action=resend_status`, { headers: { "X-Admin-Token": token } });
      const d = await r.json();
      setResendQueue({ queued: d.queued || 0, ok: d.ok || 0, failed: d.failed || 0 });
    } catch (_e) {
      // ignore
    }
  };

  const runScan = async () => {
    if (scanning) return;
    setScanning(true); setRunResult("");
    try {
      const r1 = await fetch(`${EXCLUDED_WATCHER_URL}?action=scan`, { method: "POST", headers });
      const d1 = await r1.json();
      if (!d1.ok) { setRunResult(`Ошибка сканирования: ${d1.error || "?"}`); return; }
      const r2 = await fetch(`${EXCLUDED_WATCHER_URL}?action=resend_list`, { headers: { "X-Admin-Token": token } });
      const d2 = await r2.json();
      setResendList(d2.items || []);
      setRunResult(`Найдено ${d2.count || 0} водителей · добавлено в очередь ${d1.added || 0}`);
      await loadResendQueue();
    } finally { setScanning(false); }
  };

  const runResend = async () => {
    if (resending) return;
    if (!confirm(`Отправить ${resendQueue?.queued || 0} сообщений?\n\nПо 1 сообщению каждые 2 секунды.`)) return;
    setResending(true); setRunResult("");
    try {
      const r = await fetch(`${EXCLUDED_WATCHER_URL}?action=resend`, { method: "POST", headers });
      const d = await r.json();
      if (d.ok) {
        setRunResult(`Отправлено: ${d.sent || 0} из ${d.queue_size || 0}${d.errors?.length ? `, ошибок: ${d.errors.length}` : ""}`);
        const r2 = await fetch(`${EXCLUDED_WATCHER_URL}?action=resend_list`, { headers: { "X-Admin-Token": token } });
        const d2 = await r2.json();
        setResendList(d2.items || []);
      } else {
        setRunResult(`Ошибка: ${d.reason || d.error || "?"}`);
      }
      await loadResendQueue();
    } finally { setResending(false); }
  };

  useEffect(() => {
    if (tabExpanded) loadResendQueue();
  }, [tabExpanded]);

  const sendOne = async (id: number) => {
    const item = history.find(h => h.id === id);
    const who = item ? (item.first_name || item.username || `#${id}`) : `#${id}`;
    setSendingOneId(id);
    try {
      const r = await fetch(`${EXCLUDED_WATCHER_URL}?action=send_one`, {
        method: "POST", headers, body: JSON.stringify({ id }),
      });
      const d = await r.json();
      if (d.ok) {
        toast.success(`Сообщение отправлено: ${who}`);
      } else {
        toast.error(`Не отправлено: ${who}`, { description: d.error || d.reason || "неизвестная ошибка" });
      }
      await loadHistory();
    } catch (e) {
      toast.error("Сбой соединения", { description: e instanceof Error ? e.message : String(e) });
    } finally { setSendingOneId(null); }
  };

  const deleteOne = async (id: number) => {
    if (!confirm("Удалить запись из истории?")) return;
    await fetch(`${EXCLUDED_WATCHER_URL}?action=delete_one`, {
      method: "POST", headers, body: JSON.stringify({ id }),
    });
    toast.success("Запись удалена");
    await loadHistory();
  };

  const startEdit = (h: HistoryItem) => {
    setEditingId(h.id);
    setEditName(h.first_name || "");
    setEditUsername(h.username || "");
  };

  const saveEdit = async () => {
    if (editingId == null) return;
    await fetch(`${EXCLUDED_WATCHER_URL}?action=update_one`, {
      method: "POST", headers,
      body: JSON.stringify({ id: editingId, first_name: editName, username: editUsername }),
    });
    toast.success("Изменения сохранены");
    setEditingId(null);
    await loadHistory();
  };

  const reviveLoop = async () => {
    setReviving(true); setRunResult("");
    try {
      const r = await fetch(`${EXCLUDED_WATCHER_URL}?action=revive`, { method: "POST" });
      const d = await r.json();
      if (d.ok) {
        setRunResult(`Цикл перезапущен (${d.token_preview || "новый токен"})`);
      } else {
        setRunResult(`Ошибка: ${d.reason || d.hint || "?"}`);
      }
      setTimeout(load, 2000);
    } finally { setReviving(false); }
  };

  return (
    <div className="card-glow rounded-2xl overflow-hidden">
      <ExcludedTabHeader
        tabExpanded={tabExpanded}
        setTabExpanded={setTabExpanded}
        settings={settings}
        enabled={enabled}
      />

      {tabExpanded && (
        <div className="p-4 space-y-6">
          <div className="flex items-center justify-between gap-3 px-1">
            <span className="text-[11px] text-white/40 inline-flex items-center gap-1.5">
              <Icon name="Clock" size={12} />
              Данные обновлены: {fmtAgo(lastUpdated)}
            </span>
            <button
              onClick={refreshNow}
              disabled={refreshing}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 text-xs hover:bg-white/10 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <Icon name="RefreshCw" size={12} className={refreshing ? "animate-spin" : ""} />
              Обновить
            </button>
          </div>

          <TgUserLogin
            token={token}
            authUrl={TG_USER_AUTH2_URL}
            title="Telegram-аккаунт для сообщений исключённым"
            hint="Войди другим номером — от его имени будут идти сообщения"
          />

          <ExcludedSettingsCard
            settings={settings}
            enabled={enabled}
            saving={saving}
            template={template}
            setTemplate={setTemplate}
            editingTemplate={editingTemplate}
            setEditingTemplate={setEditingTemplate}
            togglePower={togglePower}
            saveSettings={saveSettings}
            reviving={reviving}
            reviveLoop={reviveLoop}
            resendQueue={resendQueue}
            scanning={scanning}
            runScan={runScan}
            resending={resending}
            runResend={runResend}
            resendList={resendList}
            setResendList={setResendList}
            runResult={runResult}
          />

          <ExcludedHistoryCard
            history={history}
            editingId={editingId}
            editName={editName}
            setEditName={setEditName}
            editUsername={editUsername}
            setEditUsername={setEditUsername}
            setEditingId={setEditingId}
            startEdit={startEdit}
            saveEdit={saveEdit}
            sendOne={sendOne}
            deleteOne={deleteOne}
            sendingOneId={sendingOneId}
          />
        </div>
      )}
    </div>
  );
}

export default AdminExcludedTab;
