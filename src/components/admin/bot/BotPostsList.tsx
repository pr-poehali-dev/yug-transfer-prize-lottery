import Icon from "@/components/ui/icon";
import { BotPost, SEASONS } from "./botTypes";

const SEASON_LABELS: Record<string, string> = Object.fromEntries(
  SEASONS.map(s => [s.value, s.label]),
);
const SEASON_ICONS: Record<string, string> = Object.fromEntries(
  SEASONS.map(s => [s.value, s.icon]),
);

interface BotPostsListProps {
  posts: BotPost[];
  loadingPosts: boolean;
  sending: boolean;
  unusedCount: number;
  scheduleMap: Record<number, { date: Date; index: number }>;
  queueOrder: number[];
  formatNextDate: (d: Date) => string;
  onSendNow: () => void;
  onAddNew: () => void;
  onEdit: (post: BotPost) => void;
  onDelete: (id: number) => void;
  onSendOne?: (id: number) => void;
  sendingId?: number | null;
  formSlot?: React.ReactNode;
}

export function BotPostsList({
  posts,
  loadingPosts,
  sending,
  unusedCount,
  scheduleMap,
  queueOrder,
  formatNextDate,
  onSendNow,
  onAddNew,
  onEdit,
  onDelete,
  onSendOne,
  sendingId,
  formSlot,
}: BotPostsListProps) {
  return (
    <div className="rounded-2xl border border-white/8 p-3 sm:p-4" style={{ background: "rgba(255,255,255,0.02)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-7 h-7 rounded-md bg-orange-500/10 flex items-center justify-center flex-shrink-0">
            <Icon name="Calendar" size={16} className="text-orange-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-white font-medium text-base leading-tight">Ежедневные посты</h3>
            <p className="text-white/40 text-[11px] truncate">
              <Icon name="RefreshCw" size={11} className="inline mr-1" />
              Зацикленная очередь · {posts.length} {posts.length === 1 ? "пост" : posts.length < 5 ? "поста" : "постов"} · @ug_transfer_pro
              {unusedCount > 0 && unusedCount < posts.length && ` · ещё ${unusedCount} новых в первой очереди`}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={onSendNow} disabled={sending} className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium hover:opacity-80 transition-colors disabled:opacity-50">
            {sending ? "Отправка..." : "Отправить сейчас"}
          </button>
          <button onClick={onAddNew} className="px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-medium hover:opacity-80 transition-colors">
            <Icon name="Plus" size={14} className="inline mr-1" />Добавить
          </button>
        </div>
      </div>

      {formSlot}

      {loadingPosts ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <p className="text-white/30 text-center py-8">Нет постов</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-2 max-h-[calc(100vh-230px)] min-h-[300px] overflow-y-auto pr-1">
          {queueOrder.map(pid => posts.find(p => p.id === pid)!).filter(Boolean).map(post => {
            const sched = scheduleMap[post.id];
            const isNext = sched?.index === 0;
            return (
            <div key={post.id} className={`flex gap-2.5 p-2.5 rounded-xl border transition-colors ${isNext ? "border-emerald-500/30 bg-emerald-500/5" : "border-white/8 bg-white/3"}`}>
              <img loading="lazy" decoding="async" src={post.photo_url} alt="" className="w-14 h-14 object-cover rounded-lg border border-white/10 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{post.greeting}</p>
                    <p className="text-white/50 text-[11px] leading-snug mt-0.5 line-clamp-2">{post.description}</p>
                  </div>
                  <div className="flex gap-0.5 flex-shrink-0">
                    {onSendOne && (
                      <button
                        onClick={() => onSendOne(post.id)}
                        disabled={sendingId === post.id}
                        title="Отправить повторно"
                        className="w-7 h-7 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 flex items-center justify-center transition-colors disabled:opacity-40"
                      >
                        {sendingId === post.id
                          ? <div className="w-3 h-3 border border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                          : <Icon name="Send" size={14} className="text-emerald-400" />}
                      </button>
                    )}
                    <button onClick={() => onEdit(post)} className="w-7 h-7 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                      <Icon name="Pencil" size={14} className="text-white/50" />
                    </button>
                    <button onClick={() => onDelete(post.id)} className="w-7 h-7 rounded-md bg-white/5 hover:bg-red-500/20 flex items-center justify-center transition-colors">
                      <Icon name="Trash2" size={14} className="text-white/50 hover:text-red-400" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  {sched && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 ${isNext ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300" : "bg-purple-500/10 border border-purple-500/20 text-purple-300"}`}>
                      <Icon name="Clock" size={10} />
                      {formatNextDate(sched.date)}
                    </span>
                  )}
                  {post.season && post.season !== "any" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 text-amber-300">
                      <Icon name={SEASON_ICONS[post.season] || "Calendar"} size={10} />
                      {SEASON_LABELS[post.season] || post.season}
                    </span>
                  )}
                  {post.is_used && post.scheduled_date && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/40">
                      Был отправлен {new Date(post.scheduled_date).toLocaleDateString("ru-RU")}
                    </span>
                  )}
                  {post.last_tg_status && (
                    <span
                      title={post.last_tg_status === "ok" ? "Telegram: успешно" : `Telegram: ${post.last_tg_status.replace(/^err:/, "")}`}
                      className={`text-[10px] px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 ${post.last_tg_status === "ok" ? "bg-sky-500/10 border border-sky-500/20 text-sky-300" : "bg-red-500/10 border border-red-500/20 text-red-300"}`}
                    >
                      <Icon name={post.last_tg_status === "ok" ? "Send" : "AlertCircle"} size={10} />
                      TG {post.last_tg_status === "ok" ? "✓" : "✗"}
                    </span>
                  )}
                  {post.last_vk_status && (
                    <span
                      title={post.last_vk_status === "ok" ? "ВКонтакте: успешно" : `ВКонтакте: ${post.last_vk_status.replace(/^err:/, "")}`}
                      className={`text-[10px] px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 ${post.last_vk_status === "ok" ? "bg-blue-500/10 border border-blue-500/20 text-blue-300" : "bg-red-500/10 border border-red-500/20 text-red-300"}`}
                    >
                      <Icon name={post.last_vk_status === "ok" ? "Send" : "AlertCircle"} size={10} />
                      VK {post.last_vk_status === "ok" ? "✓" : "✗"}
                    </span>
                  )}
                  {isNext && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">Следующий</span>
                  )}
                  <span className="text-white/20 text-[10px] ml-auto">#{post.id}</span>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default BotPostsList;