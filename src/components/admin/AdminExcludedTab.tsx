import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { EXCLUDED_WATCHER_URL, TG_USER_AUTH2_URL } from "./adminTypes";
import { TgUserLogin } from "./TgUserLogin";

interface Props { token: string; }

interface Settings {
  enabled: boolean;
  message_template: string;
  last_checked_msg_id: number;
  last_run_at: string | null;
  loop_heartbeat: string | null;
}

function fmtAgo(ts: number | null): string {
  if (!ts) return "—";
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 5) return "только что";
  if (sec < 60) return `${sec} сек назад`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин назад`;
  const h = Math.floor(min / 60);
  return `${h} ч назад`;
}

function isLoopAlive(heartbeat: string | null): boolean {
  if (!heartbeat) return false;
  const hb = new Date(heartbeat).getTime();
  // С паузами 180с между циклами, нормальный heartbeat до ~210 сек
  // Считаем мёртвым если > 4 мин
  return Date.now() - hb < 240_000;
}

interface HistoryItem {
  user_id: number;
  username: string;
  first_name: string;
  message_sent: boolean;
  message_sent_at: string | null;
  send_status: string | null;
}

export function AdminExcludedTab({ token }: Props) {
  const [tabExpanded, setTabExpanded] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [template, setTemplate] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runResult, setRunResult] = useState<string>("");
  const [reviving, setReviving] = useState(false);
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
      <button
        type="button"
        onClick={() => setTabExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/10"
      >
        <div className="flex items-center gap-2">
          <Icon name="UserX" size={15} className="text-amber-400" />
          <span className="text-sm font-medium text-white">Авто-сообщения исключённым</span>
          {settings && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/40"}`}>
              {enabled ? "вкл" : "выкл"}
            </span>
          )}
          {settings && enabled && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${isLoopAlive(settings.loop_heartbeat) ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isLoopAlive(settings.loop_heartbeat) ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
              {isLoopAlive(settings.loop_heartbeat) ? "работает" : "цикл остановлен"}
            </span>
          )}
        </div>
        <Icon name="ChevronDown" size={16} className={`text-white/50 transition-transform ${tabExpanded ? "rotate-180" : ""}`} />
      </button>

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

          <div className="rounded-2xl border border-white/8 p-5" style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <Icon name="Settings" size={20} className="text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-medium text-lg">Настройки</h3>
                <p className="text-white/40 text-xs">Группа @UG_DRIVER · триггер @VsyaRussiabot · переменные {"{name}"} {"{username}"}</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="w-4 h-4 accent-amber-400" />
                <span className="text-sm text-white/70">Включено</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => togglePower(true)}
                disabled={saving || enabled}
                className="px-4 py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-semibold hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 transition"
              >
                <Icon name="Power" size={16} />
                {enabled ? "Уже включено" : (saving ? "Включаем..." : "Включить")}
              </button>
              <button
                onClick={() => togglePower(false)}
                disabled={saving || !enabled}
                className="px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-sm font-semibold hover:bg-red-500/25 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 transition"
              >
                <Icon name="PowerOff" size={16} />
                {!enabled ? "Уже выключено" : (saving ? "Выключаем..." : "Выключить")}
              </button>
            </div>

            <textarea
              value={template} onChange={e => setTemplate(e.target.value)}
              rows={10}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-amber-500/50 resize-none font-mono"
              placeholder="Текст сообщения — используй {name} для имени"
            />

            <div className="flex gap-2 mt-3 flex-wrap">
              <button onClick={saveSettings} disabled={saving}
                className="px-4 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-sm font-medium hover:bg-amber-500/25 disabled:opacity-50">
                {saving ? "Сохранение..." : "Сохранить"}
              </button>
              <button onClick={reviveLoop} disabled={reviving || !enabled}
                className="px-4 py-2.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-300 text-sm font-medium hover:bg-blue-500/25 disabled:opacity-50 inline-flex items-center gap-2">
                <Icon name="RefreshCw" size={14} className={reviving ? "animate-spin" : ""} />
                {reviving ? "Перезапуск..." : "Перезапустить цикл"}
              </button>
              {runResult && (
                <span className="text-xs text-white/60 self-center">{runResult}</span>
              )}
            </div>

            {settings?.last_run_at && (
              <p className="text-[11px] text-white/30 mt-2">
                Последняя проверка: {new Date(settings.last_run_at).toLocaleString("ru-RU")}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-white/8 p-5" style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                <Icon name="History" size={20} className="text-purple-400" />
              </div>
              <div>
                <h3 className="text-white font-medium text-lg">История отправок</h3>
                <p className="text-white/40 text-xs">{history.length} записей</p>
              </div>
            </div>

            {history.length === 0 ? (
              <p className="text-white/30 text-center py-6 text-sm">Пока никому не отправляли</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {history.map((h, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/3 border border-white/8">
                    <Icon
                      name={h.message_sent ? "CheckCircle" : "AlertCircle"}
                      size={16}
                      className={h.message_sent ? "text-emerald-400" : "text-red-400"}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm truncate">
                        {h.first_name || "?"} {h.username && <span className="text-white/40">@{h.username}</span>}
                      </p>
                      <p className="text-white/40 text-[11px] truncate">
                        {h.message_sent_at && new Date(h.message_sent_at).toLocaleString("ru-RU")}
                        {h.send_status && h.send_status !== "ok" && ` · ${h.send_status}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminExcludedTab;