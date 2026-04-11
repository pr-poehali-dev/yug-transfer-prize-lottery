import Icon from "@/components/ui/icon";
import { Notification } from "./adminTypes";

interface AdminNotifyTabProps {
  notifyTitle: string;
  setNotifyTitle: (v: string) => void;
  notifyMsg: string;
  setNotifyMsg: (v: string) => void;
  notifyType: string;
  setNotifyType: (v: string) => void;
  sendingNotify: boolean;
  notifyResult: { sent: number; total: number } | null;
  notifyHistory: Notification[];
  loadingHistory: boolean;
  sendPush: boolean;
  setSendPush: (v: boolean) => void;
  pushCount: number | null;
  pushResult: { sent: number; total: number } | null;
  onSubmit: (e: React.FormEvent) => void;
}

export function AdminNotifyTab({
  notifyTitle, setNotifyTitle, notifyMsg, setNotifyMsg, notifyType, setNotifyType,
  sendingNotify, notifyResult, notifyHistory, loadingHistory,
  sendPush, setSendPush, pushCount, pushResult, onSubmit,
}: AdminNotifyTabProps) {
  return (
    <div>
      <h2 className="font-oswald text-3xl font-bold text-white mb-6">Рассылка уведомлений</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card-glow rounded-2xl p-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2"><Icon name="Send" size={16} className="text-purple-400" />Новое сообщение</h3>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wider">Тип</label>
              <select value={notifyType} onChange={e => setNotifyType(e.target.value)}
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-4 py-2.5 text-white text-sm outline-none">
                <option value="info">ℹ️ Информация</option>
                <option value="promo">🎁 Акция / Предложение</option>
                <option value="raffle">🎰 Новый розыгрыш</option>
                <option value="winner">🏆 Победитель</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wider">Заголовок</label>
              <input required value={notifyTitle} onChange={e => setNotifyTitle(e.target.value)} placeholder="Например: Новый розыгрыш iPhone!"
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-4 py-2.5 text-white placeholder-muted-foreground text-sm outline-none" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wider">Текст сообщения</label>
              <textarea required value={notifyMsg} onChange={e => setNotifyMsg(e.target.value)} rows={4} placeholder="Текст который получат все клиенты в Telegram..."
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-4 py-2.5 text-white placeholder-muted-foreground text-sm outline-none resize-none" />
            </div>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div className={`w-10 h-6 rounded-full transition-colors relative ${sendPush ? "bg-purple-500" : "bg-white/10"}`}
                onClick={() => setSendPush(!sendPush)}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${sendPush ? "translate-x-5" : "translate-x-1"}`} />
              </div>
              <div>
                <p className="text-sm text-white">Browser Push</p>
                <p className="text-xs text-muted-foreground">
                  {pushCount !== null ? `${pushCount} подписчиков в браузере` : "Загрузка..."}
                </p>
              </div>
            </label>
            {notifyResult && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-emerald-400 text-sm flex items-center gap-2">
                <Icon name="CheckCircle" size={16} />Telegram: {notifyResult.sent} из {notifyResult.total}
                {pushResult && <span className="ml-2 text-purple-300">· Browser Push: {pushResult.sent}</span>}
              </div>
            )}
            <button type="submit" disabled={sendingNotify}
              className="w-full grad-btn rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-70">
              {sendingNotify ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Отправка...</> : <><Icon name="Send" size={15} />Разослать всем клиентам</>}
            </button>
          </form>
        </div>
        <div className="card-glow rounded-2xl p-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2"><Icon name="History" size={16} className="text-cyan-400" />История рассылок</h3>
          {loadingHistory ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" /></div>
          ) : notifyHistory.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">Рассылок ещё не было</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {notifyHistory.map(n => (
                <div key={n.id} className="bg-white/5 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-white text-sm font-medium">{n.title}</p>
                    <span className="text-xs text-muted-foreground shrink-0">{n.sent_at.slice(0, 10)}</span>
                  </div>
                  <p className="text-muted-foreground text-xs line-clamp-2 mb-1.5">{n.message}</p>
                  <p className="text-xs text-purple-400">Получили: {n.recipients_count} чел.</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
