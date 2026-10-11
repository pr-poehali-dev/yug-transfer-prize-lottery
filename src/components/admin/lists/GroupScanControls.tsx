import Icon from "@/components/ui/icon";
import { GroupJob, startGroupScan, stopGroupScan } from "./groupScanStore";

const STATUS: Record<string, string> = {
  done: "собрано",
  stopped: "остановлено",
  paused: "пауза",
  error: "ошибка",
  running: "идёт сбор",
};

export function GroupScanStatus({ job }: { job?: GroupJob }) {
  if (!job) return null;
  const pct = Math.max(0, Math.min(100, job.progress || 0));
  const cls = job.running ? "text-cyan-300" : job.status === "done" ? "text-emerald-300" : job.status === "error" ? "text-red-300" : "text-amber-300";
  return (
    <div className="mt-1 space-y-1">
      <div className={`text-[11px] flex flex-wrap items-center gap-x-2 ${cls}`}>
        <span className="flex items-center gap-1">
          <Icon name={job.running ? "Loader2" : job.status === "done" ? "CheckCircle2" : job.status === "error" ? "AlertCircle" : "PauseCircle"}
            fallback="Circle" size={11} className={job.running ? "animate-spin" : ""} />
          {STATUS[job.status] || job.status}
          {job.mode === "history" ? " · по сообщениям" : ""}
        </span>
        <span className="text-white/50">новых +{job.added}</span>
        {job.skipped > 0 && <span className="text-white/40">уже были {job.skipped}</span>}
        {!!job.in_base && <span className="text-violet-300">в базе из группы: {job.in_base}</span>}
        {!!job.total && <span className="text-white/40">участников {job.total}</span>}
      </div>
      {job.running && (
        <div className="h-1 rounded-full bg-white/10 overflow-hidden max-w-xs">
          <div className="h-full bg-cyan-400 transition-all" style={{ width: `${Math.max(3, pct)}%` }} />
        </div>
      )}
      {job.error && !job.running && <div className="text-[11px] text-red-300/90 line-clamp-2">{job.error}</div>}
    </div>
  );
}

export function GroupScanButton({ token, chat, title, job }: { token: string; chat: string; title: string; job?: GroupJob }) {
  if (job?.running) {
    return (
      <button onClick={() => stopGroupScan(token, chat)} title="Остановить сканирование"
        className="shrink-0 flex items-center gap-1 rounded-md px-2 py-1 text-[11px] border border-red-400/40 text-red-200 hover:bg-red-500/10">
        <Icon name="Square" size={11} />Стоп
      </button>
    );
  }
  const resume = job && ["stopped", "paused"].includes(job.status);
  return (
    <button onClick={() => startGroupScan(token, chat, title)} title="Собрать участников группы в базу"
      className="shrink-0 flex items-center gap-1 rounded-md px-2 py-1 text-[11px] border border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/10">
      <Icon name={job?.status === "done" ? "RefreshCw" : "Radar"} fallback="Play" size={11} />
      {resume ? "Продолжить" : job?.status === "done" ? "Ещё раз" : "Сканировать"}
    </button>
  );
}
