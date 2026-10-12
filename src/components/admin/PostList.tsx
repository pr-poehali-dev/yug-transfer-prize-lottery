import Icon from "@/components/ui/icon";
import type { Post } from "./adminTypes";

const STATUS_CFG = {
  draft:     { label: "Черновик",      color: "text-white/50",    bg: "bg-white/5 border-white/10",               dot: "bg-white/30" },
  scheduled: { label: "Запланирован",  color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/20",    dot: "bg-purple-400" },
  published: { label: "Опубликован",   color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20",  dot: "bg-emerald-400" },
  failed:    { label: "Ошибка",        color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20",          dot: "bg-red-400" },
  expired:   { label: "Удалён",        color: "text-white/40",    bg: "bg-white/5 border-white/10",               dot: "bg-white/25" },
};

interface PostListProps {
  posts: Post[];
  loading: boolean;
  statusFilter: string;
  editId: number | null;
  publishingId: number | null;
  deleting: number | null;
  deletingChats: number | null;
  editingInTgId: number | null;
  sendingMissingId: number | null;
  onFilterChange: (sf: string) => void;
  onRefresh: () => void;
  onPublish: (post: Post) => void;
  onEdit: (post: Post) => void;
  onEditInTg: (post: Post) => void;
  onDelete: (post: Post) => void;
  onDeleteFromChats: (post: Post) => void;
  onSendMissing: (post: Post) => void;
  onResetEdit: () => void;
}

const strip = (html: string) => html.replace(/<[^>]+>/g, "");

export function PostList({
  posts, loading, statusFilter, editId, publishingId, deleting, deletingChats, editingInTgId, sendingMissingId,
  onFilterChange, onRefresh, onPublish, onEdit, onEditInTg, onDelete, onDeleteFromChats, onSendMissing, onResetEdit,
}: PostListProps) {
  return (
    <div className="space-y-3">
      {/* Фильтры */}
      <div className="flex gap-1.5 flex-wrap">
        {(["", "draft", "scheduled", "published"] as const).map(key => {
          const labels = { "": "Все", draft: "Черновики", scheduled: "По расписанию", published: "Опубликованные" };
          return (
            <button
              key={key}
              onClick={() => onFilterChange(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === key ? "bg-purple-600 text-white" : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"}`}
            >
              {labels[key]}
            </button>
          );
        })}
        <button
          onClick={onRefresh}
          className="ml-auto w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors"
          title="Обновить"
        >
          <Icon name="RefreshCw" size={13} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="card-glow rounded-2xl p-10 text-center text-muted-foreground">
          <Icon name="Send" size={36} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">Постов пока нет</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
        {posts.map(post => {
          const st = STATUS_CFG[post.status] || STATUS_CFG.draft;
          const isActive = editId === post.id;
          const btn = "flex-1 h-7 rounded-md flex items-center justify-center transition-colors disabled:opacity-40";
          const spin = (c: string) => <div className={`w-3 h-3 border rounded-full animate-spin ${c}`} />;
          return (
            <div
              key={post.id}
              className={`rounded-2xl border overflow-hidden flex flex-col transition-all ${isActive ? "border-purple-500/50 ring-1 ring-purple-500/30" : "border-white/10 hover:border-white/20"}`}
              style={{ background: isActive ? "rgba(168,85,247,0.06)" : "rgba(255,255,255,0.03)" }}
            >
              <div className="relative h-24 sm:h-32 shrink-0 overflow-hidden bg-white/5">
                {post.photo_url && !post.photo_url.startsWith("data:") ? (
                  <img loading="lazy" decoding="async" src={post.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Icon name="Image" size={22} className="text-white/15" />
                  </div>
                )}
                <span className={`absolute top-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded-full border flex items-center gap-1 backdrop-blur-md bg-black/50 ${st.color} ${st.bg.split(" ").filter(c => c.startsWith("border")).join(" ")}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                  {st.label}
                </span>
              </div>

              <div className="p-2 sm:p-2.5 flex-1 flex flex-col gap-1">
                <p className="text-white text-xs sm:text-sm font-semibold line-clamp-1">{post.title || "Без названия"}</p>
                <p className="text-white/45 text-[11px] leading-snug line-clamp-2 flex-1">{strip(post.text)}</p>
                <div className="flex items-center gap-x-2 gap-y-0.5 text-[10px] text-white/30 flex-wrap">
                  <span className="hidden sm:inline">{new Date(post.created_at!).toLocaleString("ru", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  {post.scheduled_at && (
                    <span className="text-purple-400/80 flex items-center gap-1">
                      <Icon name="Clock" size={10} />
                      {new Date(post.scheduled_at).toLocaleString("ru", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                  {post.published_at && (
                    <span className="text-emerald-400/70 flex items-center gap-1">
                      <Icon name="CheckCircle2" size={10} />
                      {new Date(post.published_at).toLocaleString("ru", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                  {post.auto_expire_at && post.status !== "expired" && (
                    <span className="text-orange-400/70 flex items-center gap-1" title="Автоудаление">
                      <Icon name="Timer" size={10} />
                      удалится {new Date(post.auto_expire_at).toLocaleString("ru", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                  {post.button_text && (
                    <span className="hidden sm:flex text-blue-400/60 items-center gap-1 truncate max-w-full">
                      <Icon name="MousePointer" size={10} />
                      {post.button_text}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-1 p-1.5 border-t border-white/5">
                <button
                  onClick={() => onPublish(post)}
                  disabled={publishingId === post.id}
                  title={post.status === "published" ? "Отправить повторно" : "Опубликовать сейчас"}
                  className={`${btn} bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400`}
                >
                  {publishingId === post.id
                    ? spin("border-emerald-400/30 border-t-emerald-400")
                    : <Icon name={post.status === "published" ? "SendHorizontal" : "Send"} size={13} />}
                </button>
                <button
                  onClick={() => isActive ? onResetEdit() : onEdit(post)}
                  title={isActive ? "Закрыть" : "Редактировать"}
                  className={`${btn} ${isActive ? "bg-purple-500/20 text-purple-300" : "bg-blue-500/10 hover:bg-blue-500/20 text-blue-400"}`}
                >
                  <Icon name={isActive ? "X" : "Pencil"} size={13} />
                </button>
                {post.status === "published" && post.telegram_message_id && isActive && (
                  <button
                    onClick={() => onEditInTg(post)}
                    disabled={editingInTgId === post.id}
                    title="Обновить в Telegram"
                    className={`${btn} bg-sky-500/10 hover:bg-sky-500/20 text-sky-400`}
                  >
                    {editingInTgId === post.id
                      ? spin("border-sky-400/30 border-t-sky-400")
                      : <Icon name="RefreshCw" size={13} />}
                  </button>
                )}
                {post.status === "published" && (
                  <button
                    onClick={() => onSendMissing(post)}
                    disabled={sendingMissingId === post.id}
                    title="Дослать в группы, где поста нет"
                    className={`${btn} bg-amber-500/10 hover:bg-amber-500/20 text-amber-400`}
                  >
                    {sendingMissingId === post.id
                      ? spin("border-amber-400/30 border-t-amber-400")
                      : <Icon name="SendToBack" size={13} />}
                  </button>
                )}
                {post.status === "published" && (
                  <button
                    onClick={() => onDeleteFromChats(post)}
                    disabled={deletingChats === post.id}
                    title="Удалить из групп"
                    className={`${btn} bg-orange-500/10 hover:bg-orange-500/20 text-orange-400`}
                  >
                    {deletingChats === post.id
                      ? spin("border-orange-400/30 border-t-orange-400")
                      : <Icon name="MessageSquareX" size={13} />}
                  </button>
                )}
                <button
                  onClick={() => onDelete(post)}
                  disabled={deleting === post.id}
                  title="Удалить"
                  className={`${btn} bg-red-500/10 hover:bg-red-500/20 text-red-400`}
                >
                  {deleting === post.id
                    ? spin("border-red-400/30 border-t-red-400")
                    : <Icon name="Trash2" size={13} />}
                </button>
              </div>
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
}

export default PostList;