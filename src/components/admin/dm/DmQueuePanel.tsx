import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { AccountLoginForm } from "../accounts/AccountLoginForm";
import { DmAccount, LoginStep } from "./dmTypes";

interface DmQueuePanelProps {
  pendingTotal: number;
  busy: boolean;
  accounts: DmAccount[];
  liveAccounts: DmAccount[];
  allSelected: boolean;
  selected: Set<number>;
  runningId: number | null;
  runLog: string;
  clickTotal: number;
  // toolbar actions
  loginStep: LoginStep;
  setLoginStep: (s: LoginStep) => void;
  resetLogin: () => void;
  seed: () => void;
  redistribute: (silent?: boolean) => void;
  cleanInvalid: () => void;
  clearQueue: () => void;
  // login form
  loginPhone: string;
  loginCode: string;
  loginPwd: string;
  loginLabel: string;
  loginBusy: boolean;
  loginErr: string | null;
  setLoginPhone: (v: string) => void;
  setLoginCode: (v: string) => void;
  setLoginPwd: (v: string) => void;
  setLoginLabel: (v: string) => void;
  loginSendCode: () => void;
  loginVerifyCode: () => void;
  loginVerify2fa: () => void;
  // list actions
  toggleSelect: (id: number) => void;
  toggleSelectAll: () => void;
  runAccount: (acc: DmAccount) => void;
  runSelected: () => void;
}

export function DmQueuePanel({
  pendingTotal, busy, accounts, liveAccounts, allSelected, selected, runningId, runLog, clickTotal,
  loginStep, setLoginStep, resetLogin, seed, redistribute, cleanInvalid, clearQueue,
  loginPhone, loginCode, loginPwd, loginLabel, loginBusy, loginErr,
  setLoginPhone, setLoginCode, setLoginPwd, setLoginLabel, loginSendCode, loginVerifyCode, loginVerify2fa,
  toggleSelect, toggleSelectAll, runAccount, runSelected,
}: DmQueuePanelProps) {
  return (
    <div className="glass rounded-xl p-4 border border-white/5 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs font-semibold">Получатели: <span className="text-amber-300">{pendingTotal}</span> в очереди</div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline"
            onClick={() => { if (loginStep === "idle") setLoginStep("phone"); else resetLogin(); }}
            className="gap-1 text-xs text-emerald-300">
            <Icon name="UserPlus" size={13} />Добавить аккаунт
          </Button>
          <Button size="sm" variant="outline" onClick={seed} disabled={busy} className="gap-1 text-xs">
            <Icon name="Download" size={13} />Заполнить из инвайтов
          </Button>
          <Button size="sm" variant="outline" onClick={() => redistribute(false)} disabled={busy} className="gap-1 text-xs text-cyan-300">
            <Icon name="Shuffle" size={13} />Распределить
          </Button>
          <Button size="sm" variant="outline" onClick={cleanInvalid} disabled={busy} className="gap-1 text-xs text-amber-300">
            <Icon name="Filter" size={13} />Убрать без юзернейма
          </Button>
          <Button size="sm" variant="outline" onClick={clearQueue} disabled={busy} className="gap-1 text-xs text-red-300">
            <Icon name="Trash2" size={13} />Очистить
          </Button>
        </div>
      </div>

      {/* Вход нового аккаунта по номеру */}
      {loginStep !== "idle" && (
        <AccountLoginForm
          step={loginStep}
          phone={loginPhone}
          code={loginCode}
          pwd={loginPwd}
          label={loginLabel}
          busy={loginBusy}
          err={loginErr}
          onPhone={setLoginPhone}
          onCode={setLoginCode}
          onPwd={setLoginPwd}
          onLabel={setLoginLabel}
          onSendCode={loginSendCode}
          onVerifyCode={loginVerifyCode}
          onVerify2fa={loginVerify2fa}
          onCancel={resetLogin}
        />
      )}

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
  );
}

export default DmQueuePanel;
