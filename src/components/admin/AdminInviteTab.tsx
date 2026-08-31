import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { TG_ACCOUNTS_URL } from "./adminTypes";
import type { TgAccount } from "./adminTypes";

interface InviteStats {
  total: number;
  pending: number;
  added: number;
  failed: number;
  no_username: number;
  added_today: number;
}

interface AdminInviteTabProps {
  token: string;
  expanded?: boolean;
  onToggle?: () => void;
}

export function AdminInviteTab({ token, expanded: controlledExpanded, onToggle }: AdminInviteTabProps) {
  const [localExpanded, setLocalExpanded] = useState(false);
  const expanded = controlledExpanded ?? localExpanded;
  const toggleExpanded = onToggle ?? (() => setLocalExpanded(v => !v));

  const [stats, setStats] = useState<InviteStats | null>(null);
  const [accounts, setAccounts] = useState<TgAccount[]>([]);
  const [target, setTarget] = useState("");
  const [targetDraft, setTargetDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingTarget, setSavingTarget] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${TG_ACCOUNTS_URL}?action=invite_stats`, { headers: { "X-Admin-Token": token } });
      const data = await res.json();
      if (data.ok) {
        setStats(data.stats);
        setAccounts(data.accounts || []);
        setTarget(data.invite_target || "");
        setTargetDraft(data.invite_target || "");
      }
    } catch { /* */ }
    setLoading(false);
  };

  useEffect(() => { if (expanded && !stats) load(); }, [expanded]);

  const saveTarget = async () => {
    if (!targetDraft.trim()) return;
    setSavingTarget(true);
    try {
      const res = await fetch(`${TG_ACCOUNTS_URL}?action=set_invite_target`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify({ target: targetDraft.trim() }),
      });
      const data = await res.json();
      if (data.ok) setTarget(data.invite_target);
    } catch { /* */ }
    setSavingTarget(false);
  };

  const liveAccounts = accounts.filter(a => !a.is_banned);

  return (
    <div className="card-glow rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/10"
      >
        <div className="flex items-center gap-2">
          <Icon name="UserPlus" size={15} className="text-emerald-400" />
          <span className="text-sm font-medium text-white">Invite</span>
          {stats && <span className="text-[11px] text-white/40">· {stats.pending} в очереди</span>}
        </div>
        <Icon name="ChevronDown" size={16}
          className={`text-white/50 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="p-4 space-y-3">
          {/* Группа */}
          <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/15 p-3">
            <p className="text-[11px] text-emerald-300 font-medium flex items-center gap-1.5">
              <Icon name="Users" size={12} /> Куда приглашаем
            </p>
            <div className="flex gap-1.5 mt-2">
              <input
                value={targetDraft}
                onChange={e => setTargetDraft(e.target.value)}
                placeholder="https://t.me/moy_transfer"
                className="flex-1 min-w-0 bg-white/5 border border-white/10 focus:border-emerald-500/50 rounded-lg px-2.5 py-1.5 text-white text-sm outline-none placeholder-white/20"
              />
              <button
                type="button"
                onClick={saveTarget}
                disabled={savingTarget || targetDraft.trim() === target}
                className="shrink-0 px-3 rounded-lg bg-emerald-500/80 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-500/80 text-white text-xs font-medium transition-colors"
              >
                {savingTarget ? "…" : "Сохранить"}
              </button>
            </div>
            {target && (
              <a href={target} target="_blank" rel="noreferrer"
                className="text-[11px] text-emerald-400/80 hover:text-emerald-300 mt-1.5 inline-flex items-center gap-1">
                <Icon name="ExternalLink" size={11} /> {target}
              </a>
            )}
          </div>

          {/* Статистика базы */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-white/60 font-medium flex items-center gap-1.5">
                <Icon name="Database" size={12} /> База контактов
              </p>
              <button type="button" onClick={load} disabled={loading}
                className="text-white/40 hover:text-white transition-colors">
                <Icon name="RefreshCw" size={13} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
            {stats ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-2">
                {[
                  { label: "В очереди", value: stats.pending, color: "text-sky-300" },
                  { label: "Приглашено", value: stats.added, color: "text-emerald-300" },
                  { label: "Сегодня", value: stats.added_today, color: "text-purple-300" },
                  { label: "Ошибки", value: stats.failed, color: "text-amber-300" },
                  { label: "Без username", value: stats.no_username, color: "text-white/40" },
                  { label: "Всего", value: stats.total, color: "text-white/70" },
                ].map(s => (
                  <div key={s.label} className="rounded-lg bg-white/5 px-2 py-1.5">
                    <p className={`text-sm font-semibold ${s.color}`}>{s.value.toLocaleString("ru")}</p>
                    <p className="text-[10px] text-white/40">{s.label}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-white/30 mt-2">{loading ? "Загружаю…" : "Нет данных"}</p>
            )}
          </div>

          {/* Аккаунты */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
            <p className="text-[11px] text-white/60 font-medium flex items-center gap-1.5">
              <Icon name="UserCheck" size={12} /> Аккаунты для приглашений · {liveAccounts.length}
            </p>
            <div className="mt-2 space-y-1">
              {accounts.map(a => (
                <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-2 py-1.5">
                  <div className="min-w-0">
                    <p className="text-[12px] text-white truncate">{a.label || a.phone || `Аккаунт ${a.id}`}</p>
                    <p className="text-[10px] text-white/40">
                      {a.is_banned ? "заблокирован" : a.needs_warmup ? "на прогреве" : "готов"}
                      {" · "}сегодня {a.daily_invites_used}
                    </p>
                  </div>
                  <span className={`shrink-0 w-2 h-2 rounded-full ${
                    a.is_banned ? "bg-red-400" : a.needs_warmup ? "bg-amber-400" : "bg-emerald-400"
                  }`} />
                </div>
              ))}
              {!accounts.length && (
                <p className="text-[11px] text-white/30">{loading ? "Загружаю…" : "Аккаунтов нет"}</p>
              )}
            </div>
          </div>

          <p className="text-[11px] text-white/30 flex items-start gap-1.5">
            <Icon name="Info" size={12} className="mt-0.5 shrink-0" />
            Следующий шаг — запуск рассылки приглашений с лимитами по каждому аккаунту.
          </p>
        </div>
      )}
    </div>
  );
}

export default AdminInviteTab;
