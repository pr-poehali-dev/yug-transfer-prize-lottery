import Icon from "@/components/ui/icon";
import { DmCounts } from "./dmTypes";

interface DmHeaderProps {
  clickTotal: number;
  setClickTotal: (n: number) => void;
  runningId: number | null;
  counts: DmCounts | null;
}

export function DmHeader({ clickTotal, setClickTotal, runningId, counts }: DmHeaderProps) {
  return (
    <>
      <div className="glass rounded-xl p-3 border border-white/5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shrink-0">
          <Icon name="Mail" size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold">Рассылка в личку</h2>
          <p className="text-[11px] text-muted-foreground">Текст + фото · по {clickTotal} сообщений за нажатие — чтобы не получить бан</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] text-muted-foreground mr-1 hidden sm:inline">За нажатие:</span>
          {[10, 20, 30].map(n => (
            <button key={n} onClick={() => setClickTotal(n)} disabled={!!runningId}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition disabled:opacity-40 ${clickTotal === n ? "bg-blue-600 text-white" : "bg-white/5 text-muted-foreground hover:bg-white/10"}`}>
              {n}
            </button>
          ))}
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
    </>
  );
}

export default DmHeader;
