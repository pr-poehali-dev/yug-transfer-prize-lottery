import Icon from "@/components/ui/icon";
import { inputCls } from "./listTypes";

export interface GroupState {
  running: boolean;
  title: string;
  added: number;
  skipped: number;
  total: number;
  progress: number;
  mode?: string;
}

interface Props {
  groupChat: string;
  setGroupChat: (v: string) => void;
  group: GroupState | null;
  onStop: () => void;
  onScan: (mode: "members" | "photos") => void;
}

export function ModerationGroupPanel({ groupChat, setGroupChat, group, onStop, onScan }: Props) {
  return (
    <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.05] p-3 space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <input value={groupChat} onChange={(e) => setGroupChat(e.target.value)} disabled={group?.running}
          placeholder="Ссылка t.me/…, @группа или ID группы (-100…)" className={inputCls} />
        {group?.running ? (
          <button onClick={onStop}
            className="shrink-0 rounded-xl px-4 py-2 text-sm bg-red-500/80 hover:bg-red-500 text-white">Остановить</button>
        ) : (
          <>
            <button onClick={() => onScan("members")} disabled={!groupChat.trim()}
              className="shrink-0 grad-btn text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50">Участники</button>
            <button onClick={() => onScan("photos")} disabled={!groupChat.trim()}
              className="shrink-0 rounded-xl px-4 py-2 text-sm font-medium border border-sky-400/50 text-sky-200 hover:bg-sky-500/10 disabled:opacity-50 flex items-center gap-1.5">
              <Icon name="Image" size={14} />Фото
            </button>
          </>
        )}
      </div>
      <div className="text-[11px] text-white/40">
        Участники попадут в «На модерации». Кто уже есть в базе (по Telegram ID или @username) — пропускается, дублей не будет.
        Полный список доступен, если один из ваших аккаунтов — админ группы; иначе соберём тех, кто писал сообщения.
        «Фото» — подтянет аватарки уже загруженных участников этой группы (нужен аккаунт-админ, лимиты поиска не тратятся).
      </div>
      {group && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center gap-2 text-sm text-white">
            {group.running && <Icon name="Loader2" size={14} className="animate-spin text-sky-300" />}
            <span className="truncate">{group.title}</span>
            <span className="ml-auto text-xs text-white/60 shrink-0">
              {group.mode === "photos" ? `фото ${group.added} · без фото ${group.skipped}` : `новых ${group.added} · уже в базе ${group.skipped}`}
              {group.total ? ` · в группе ${group.total}` : ""}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-sky-400 transition-all" style={{ width: `${Math.min(100, group.progress)}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default ModerationGroupPanel;
