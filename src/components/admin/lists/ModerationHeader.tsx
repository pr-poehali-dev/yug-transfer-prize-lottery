import { RefObject } from "react";
import Icon from "@/components/ui/icon";

interface Props {
  count: number;
  fileRef: RefObject<HTMLInputElement>;
  importing: boolean;
  scanRunning: boolean;
  onBack: () => void;
  onImportFile: (file: File) => void;
  onToggleGroup: () => void;
  onStopScan: () => void;
  onScanAll: () => void;
}

export function ModerationHeader({
  count, fileRef, importing, scanRunning, onBack, onImportFile, onToggleGroup, onStopScan, onScanAll,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button onClick={onBack}
        className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm border border-white/10 text-white/70 hover:text-white hover:bg-white/5">
        <Icon name="ArrowLeft" size={14} />Назад
      </button>
      <Icon name="Clock" size={18} className="text-amber-400" />
      <span className="text-base font-medium text-white">На модерации</span>
      <span className="text-xs text-white/40">· {count}</span>
      <div className="ml-auto flex flex-wrap gap-2">
        <input ref={fileRef} type="file" accept=".txt,.csv" className="hidden"
          onChange={(e) => e.target.files?.[0] && onImportFile(e.target.files[0])} />
        <button onClick={onToggleGroup}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm border border-sky-500/40 text-sky-200 hover:bg-sky-500/10">
          <Icon name="Users" size={14} />Сканировать группу
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={importing}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm border border-white/10 text-white/80 hover:bg-white/5 disabled:opacity-60">
          <Icon name={importing ? "Loader2" : "Upload"} size={14} className={importing ? "animate-spin" : ""} />
          Загрузить список
        </button>
        {scanRunning ? (
          <button onClick={onStopScan}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-red-500/80 hover:bg-red-500 text-white">
            <Icon name="Square" size={13} />Остановить
          </button>
        ) : (
          <button onClick={onScanAll} title="Подтянуть фото, имя, описание и ID для всех карточек на модерации"
            className="grad-btn text-white rounded-xl px-4 py-2 text-sm font-medium flex items-center gap-2">
            <Icon name="ScanSearch" fallback="Search" size={15} />Подтянуть всё и фото
          </button>
        )}
      </div>
    </div>
  );
}

export default ModerationHeader;
