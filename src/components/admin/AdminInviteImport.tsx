import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { INVITE_TARGETS_URL, InviteStats, InviteTarget } from "./adminTypes";

interface ImportResult {
  inserted: number;
  skipped_dup: number;
  skipped_bad: number;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: "Ожидает", color: "text-amber-300 bg-amber-500/15" },
  added: { label: "Добавлен", color: "text-green-300 bg-green-500/15" },
  privacy: { label: "Приватность", color: "text-orange-300 bg-orange-500/15" },
  invited_link: { label: "Ссылка", color: "text-blue-300 bg-blue-500/15" },
  failed: { label: "Ошибка", color: "text-red-300 bg-red-500/15" },
};

export function AdminInviteImport({ token }: { token: string }) {
  const [stats, setStats] = useState<InviteStats | null>(null);
  const [recent, setRecent] = useState<InviteTarget[]>([]);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const headers = { "Content-Type": "application/json", "X-Admin-Token": token };

  async function load() {
    try {
      const r = await fetch(INVITE_TARGETS_URL, { headers });
      const j = await r.json();
      setStats(j.stats || null);
      setRecent(j.recent || []);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => { load(); }, []);

  function parseInput(raw: string): string[] {
    const lines = raw.split(/[\n,;\t]+/);
    const out: string[] = [];
    for (const line of lines) {
      const cells = line.split(/[,;\t]/);
      for (const cell of cells) {
        const v = cell.trim();
        if (v) out.push(v);
      }
    }
    return out;
  }

  async function importItems(items: string[], source: string) {
    if (items.length === 0) {
      setErr("Список пуст");
      return;
    }
    setBusy(true); setErr(null); setResult(null);
    setProgress({ done: 0, total: items.length });

    const BATCH = 300;
    let inserted = 0, skipped_dup = 0, skipped_bad = 0;
    let lastJson: { stats?: InviteStats; recent?: InviteTarget[] } | null = null;

    try {
      for (let i = 0; i < items.length; i += BATCH) {
        const chunk = items.slice(i, i + BATCH);
        const r = await fetch(`${INVITE_TARGETS_URL}?action=import`, {
          method: "POST", headers,
          body: JSON.stringify({ items: chunk, source }),
        });
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}`);
        }
        const j = await r.json();
        if (j.error) throw new Error(j.error);
        inserted += j.inserted || 0;
        skipped_dup += j.skipped_dup || 0;
        skipped_bad += j.skipped_bad || 0;
        lastJson = j;
        setProgress({ done: Math.min(i + BATCH, items.length), total: items.length });
      }
      setResult({ inserted, skipped_dup, skipped_bad });
      if (lastJson?.stats) setStats(lastJson.stats);
      if (lastJson?.recent) setRecent(lastJson.recent);
      setText("");
    } catch (e) {
      setErr(`Ошибка: ${String(e)}. Загружено до ошибки: ${inserted}`);
      await load();
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function importFromText() {
    const items = parseInput(text);
    await importItems(items, "manual");
  }

  async function importFromFile(file: File) {
    const raw = await file.text();
    const items = parseInput(raw);
    await importItems(items, `file:${file.name}`);
  }

  async function clearAll() {
    if (!confirm("Удалить ВСЕ записи из списка кандидатов? Действие нельзя отменить.")) return;
    setBusy(true);
    try {
      const r = await fetch(`${INVITE_TARGETS_URL}?action=clear`, {
        method: "POST", headers, body: "{}",
      });
      const j = await r.json();
      setStats(j.stats || null);
      setRecent(j.recent || []);
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  async function deleteOne(id: number) {
    setBusy(true);
    try {
      const r = await fetch(`${INVITE_TARGETS_URL}?action=delete`, {
        method: "POST", headers, body: JSON.stringify({ id }),
      });
      const j = await r.json();
      setStats(j.stats || null);
      setRecent(j.recent || []);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass rounded-2xl p-4 border border-white/5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center hover:opacity-90 transition shrink-0"
          title={collapsed ? "Раскрыть" : "Свернуть"}
        >
          <Icon name="ListPlus" size={14} />
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex-1 min-w-0 flex items-center gap-2 text-left"
        >
          <h3 className="text-sm font-semibold flex-shrink-0">Кандидаты</h3>
          {stats && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
              <span>·</span>
              <span><b className="text-amber-300">{stats.pending}</b> ожидают</span>
              <span>·</span>
              <span><b className="text-green-300">{stats.added}</b> добавлено</span>
              {stats.failed > 0 && <><span>·</span><span><b className="text-red-300">{stats.failed}</b> ошибок</span></>}
            </div>
          )}
          <Icon name={collapsed ? "ChevronDown" : "ChevronUp"} size={14} className="text-muted-foreground ml-auto shrink-0" />
        </button>
        {!collapsed && (
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs hover:opacity-90 transition shrink-0"
          >
            <Icon name={open ? "X" : "Upload"} size={13} />
            {open ? "Закрыть" : "Загрузить"}
          </button>
        )}
      </div>

      {!collapsed && stats && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-4 mb-4">
          <StatCard label="Всего" value={stats.total} color="text-white" />
          <StatCard label="Ожидают" value={stats.pending} color="text-amber-300" />
          <StatCard label="Добавлено" value={stats.added} color="text-green-300" />
          <StatCard label="Приватность" value={stats.privacy} color="text-orange-300" />
          <StatCard label="Ссылка" value={stats.invited_link} color="text-blue-300" />
          <StatCard label="Ошибки" value={stats.failed} color="text-red-300" />
        </div>
      )}

      {!collapsed && (<>
      {open && (
        <div className="border border-white/10 rounded-xl p-4 bg-white/[0.02] space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Загрузить список</div>
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.tsv,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importFromFile(f);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs hover:bg-white/10 transition disabled:opacity-50"
              >
                <Icon name="FileUp" size={13} />
                Файл CSV/TSV
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Или вставь юзернеймы (по одному на строку, можно с @, ссылки t.me/... тоже подойдут)
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"@username1\nusername2\nhttps://t.me/username3\n+79991234567"}
              rows={8}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-emerald-500 resize-y"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={importFromText}
              disabled={busy || !text.trim()}
              className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm hover:opacity-90 transition disabled:opacity-50"
            >
              {busy ? "Импорт..." : "Импортировать"}
            </button>
            <button
              onClick={() => { setText(""); setResult(null); setErr(null); }}
              disabled={busy}
              className="px-4 py-2 rounded-lg border border-white/10 text-sm hover:bg-white/5 transition disabled:opacity-50"
            >
              Очистить поле
            </button>
          </div>

          {progress && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Загрузка батчами...</span>
                <span className="font-mono">{progress.done} / {progress.total}</span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
                  style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {result && (
            <div className="text-xs bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-emerald-200">
              Добавлено новых: <b>{result.inserted}</b> · уже было: {result.skipped_dup} · невалидных: {result.skipped_bad}
            </div>
          )}
          {err && (
            <div className="text-xs bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-300">
              {err}
            </div>
          )}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Последние записи
          </div>
          {stats && stats.total > 0 && (
            <button
              onClick={clearAll}
              disabled={busy}
              className="flex items-center gap-1.5 text-[11px] text-red-400 hover:text-red-300 transition disabled:opacity-50"
            >
              <Icon name="Trash2" size={12} />
              Очистить весь список
            </button>
          )}
        </div>
        {recent.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            Список пуст. Нажми «Загрузить» и вставь юзернеймы.
          </div>
        ) : (
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {recent.map((t) => {
              const meta = STATUS_META[t.status] || { label: t.status, color: "text-muted-foreground bg-white/5" };
              return (
                <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 group">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">
                      {t.username ? <span className="text-blue-300">@{t.username}</span> : <span className="font-mono text-emerald-300">{t.phone}</span>}
                      {t.first_name && <span className="text-muted-foreground ml-2">· {t.first_name}</span>}
                    </div>
                    {t.error && <div className="text-[10px] text-red-400 truncate">{t.error}</div>}
                  </div>
                  <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${meta.color}`}>
                    {meta.label}
                  </span>
                  <button
                    onClick={() => deleteOne(t.id)}
                    disabled={busy}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-red-400 transition"
                  >
                    <Icon name="X" size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </>)}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-white/10 p-2 text-center">
      <div className="text-[9px] uppercase text-muted-foreground tracking-wider">{label}</div>
      <div className={`text-lg font-bold mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}