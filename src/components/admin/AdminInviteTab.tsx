import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { TG_ACCOUNTS_URL, INVITE_BASES_URL } from "./adminTypes";
import type { TgAccount, InviteBase } from "./adminTypes";
import { InviteBasesBlock } from "./invite/InviteBasesBlock";
import { InviteRunBlock } from "./invite/InviteRunBlock";
import { useInviteRun } from "./invite/useInviteRun";
import { AddAccountForm } from "./invite/AddAccountForm";

interface AdminInviteTabProps {
  token: string;
  expanded?: boolean;
  onToggle?: () => void;
}

export function AdminInviteTab({ token, expanded: controlledExpanded, onToggle }: AdminInviteTabProps) {
  const [localExpanded, setLocalExpanded] = useState(false);
  const expanded = controlledExpanded ?? localExpanded;
  const toggleExpanded = onToggle ?? (() => setLocalExpanded(v => !v));

  const [accounts, setAccounts] = useState<TgAccount[]>([]);
  const [bases, setBases] = useState<InviteBase[]>([]);
  const [activeBase, setActiveBase] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [target, setTarget] = useState("");
  const [targetDraft, setTargetDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingTarget, setSavingTarget] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [accRes, basesRes] = await Promise.all([
        fetch(`${TG_ACCOUNTS_URL}?action=invite_stats`, { headers: { "X-Admin-Token": token } }),
        fetch(INVITE_BASES_URL, { headers: { "X-Admin-Token": token } }),
      ]);
      const acc = await accRes.json();
      if (acc.ok) {
        setAccounts(acc.accounts || []);
        setTarget(acc.invite_target || "");
        setTargetDraft(acc.invite_target || "");
      }
      const bs = await basesRes.json();
      if (bs.ok) { setBases(bs.bases || []); setActiveBase(bs.active_base || 0); }
      setLoaded(true);
    } catch { /* */ }
    setLoading(false);
  };

  const run = useInviteRun(token, load);

  useEffect(() => {
    if (expanded && !loaded) { load(); run.loadState(); }
  }, [expanded]);

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
      <div className="flex items-stretch border-b border-white/10">
        <button
          type="button"
          onClick={toggleExpanded}
          className="flex-1 min-w-0 flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Icon name="UserPlus" size={15} className="text-emerald-400" />
            <span className="text-sm font-medium text-white">Invite</span>
            {run.live ? (
              <span className="text-[11px] text-emerald-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                идёт · {run.state?.added || 0}
              </span>
            ) : !!activeBase && (
              <span className="text-[11px] text-white/40 truncate">
                · {(bases.find(b => b.id === activeBase)?.pending || 0).toLocaleString("ru")} в очереди
              </span>
            )}
          </div>
          <Icon name="ChevronDown" size={16}
            className={`shrink-0 text-white/50 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
        <button
          type="button"
          onClick={run.toggle}
          disabled={run.busy || (!run.live && !run.state?.is_active && !run.canStart)}
          className={`shrink-0 px-4 flex items-center gap-1.5 text-[12px] font-semibold text-white transition-colors disabled:opacity-30 ${
            run.live ? "bg-red-500/70 hover:bg-red-500" : "bg-emerald-500/70 hover:bg-emerald-500"
          }`}
        >
          <Icon name={run.live ? "Square" : "Play"} size={13} />
          {run.live ? "Стоп" : "Старт"}
        </button>
      </div>

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

          <InviteBasesBlock
            token={token}
            bases={bases}
            activeBase={activeBase}
            loading={loading}
            onChanged={(b, a) => { setBases(b); setActiveBase(a); }}
            onReload={load}
          />

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
                  <div className="flex items-center gap-2 shrink-0">
                    {run.joined[a.id] && (
                      <span className="text-[10px] text-emerald-300/70 max-w-[90px] truncate">
                        {run.joined[a.id]}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => run.joinGroup(a.id)}
                      disabled={run.joining === a.id}
                      className="px-2 py-1 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-50 text-emerald-300 text-[10px] font-medium transition-colors flex items-center gap-1"
                    >
                      <Icon name={run.joining === a.id ? "Loader2" : "LogIn"} size={11}
                        className={run.joining === a.id ? "animate-spin" : ""} />
                      В группу
                    </button>
                    <span className={`w-2 h-2 rounded-full ${
                      a.is_banned ? "bg-red-400" : a.needs_warmup ? "bg-amber-400" : "bg-emerald-400"
                    }`} />
                  </div>
                </div>
              ))}
              {!accounts.length && (
                <p className="text-[11px] text-white/30">{loading ? "Загружаю…" : "Аккаунтов нет"}</p>
              )}
            </div>
            <AddAccountForm token={token} onDone={load} />
          </div>

          <InviteRunBlock
            state={run.state}
            busy={run.busy}
            live={run.live}
            nextIn={run.nextIn}
            canStart={run.canStart}
            onToggle={run.toggle}
            onReload={run.loadState}
            onPace={run.changePace}
            error={run.error}
            onCheck={run.checkAccounts}
            checking={run.checking}
            checkRows={run.checkRows}
          />

          <p className="text-[11px] text-white/30 flex items-start gap-1.5">
            <Icon name="Info" size={12} className="mt-0.5 shrink-0" />
            Аккаунты чередуются автоматически. Чем выше скорость, тем больше приглашений в день, но выше риск ограничений Telegram.
          </p>
        </div>
      )}
    </div>
  );
}

export default AdminInviteTab;