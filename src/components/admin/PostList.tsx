import { useState } from "react";
import Icon from "@/components/ui/icon";
import type { Post } from "./adminTypes";

const STATUS_CFG = {
  draft:     { label: "Черновик",      color: "text-white/50",    bg: "bg-white/5 border-white/10",               dot: "bg-white/30" },
  scheduled: { label: "Запланирован",  color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/20",    dot: "bg-purple-400" },
  published: { label: "Опубликован",   color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20",  dot: "bg-emerald-400" },
  failed:    { label: "Ошибка",        color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20",          dot: "bg-red-400" },
};

interface PostListProps {
  posts: Post[];
  loading: boolean;
  statusFilter: string;
  editId: number | null;
  publishingId: number | null;
  deleting: number | null;
  editingInTgId: number | null;
  onFilterChange: (sf: string) => void;
  onRefresh: () => void;
  onPublish: (post: Post) => void;
  onEdit: (post: Post) => void;
  onEditInTg: (post: Post) => void;
  onDelete: (post: Post) => void;
  onResetEdit: () => void;
}

const strip = (html: string) => html.replace(/<[^>]+>/g, "");

export function PostList({
  posts, loading, statusFilter, editId, publishingId, deleting, editingInTgId,
  onFilterChange, onRefresh, onPublish, onEdit, onEditInTg, onDelete, onResetEdit,
}: PostListProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="card-glow rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-white/5 transition-colors border-b border-white/10"
      >
        <div className="flex items-center gap-2">
          <Icon name="List" size={14} className="text-purple-400" />
          <span className="text-sm font-medium text-white">Опубликованные посты</span>
          <span className="text-[11px] text-white/40">· {posts.length}</span>
        </div>
        <Icon
          name="ChevronDown"
          size={16}
          className={`text-white/50 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {!expanded ? null : (
      <div className="p-3.5 space-y-3">
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
        posts.map(post => {
          const st = STATUS_CFG[post.status] || STATUS_CFG.draft;
          const isActive = editId === post.id;
          return (
            <div
              key={post.id}
              className={`rounded-2xl border transition-all ${isActive ? "border-purple-500/40 bg-purple-500/5" : "border-white/8 bg-white/3 hover:bg-white/5"}`}
              style={{ background: isActive ? undefined : "rgba(255,255,255,0.02)" }}
            >
              <div className="p-4 flex gap-3">
                {/* Фото */}
                <div className="shrink-0">
                  {post.photo_url && !post.photo_url.startsWith("data:") ? (
                    <div className="w-14 h-14 rounded-xl overflow-hidden border border-white/10">
                      <img src={post.photo_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                      <Icon name="Image" size={18} className="text-white/15" />
                    </div>
                  )}
                </div>

                {/* Контент */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {post.title && <p className="text-white text-sm font-medium truncate">{post.title}</p>}
                    <span className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 shrink-0 ${st.bg} ${st.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                      {st.label}
                    </span>
                  </div>
                  <p className="text-white/40 text-xs leading-relaxed line-clamp-2 mb-2">
                    {strip(post.text).slice(0, 100)}{strip(post.text).length > 100 ? "…" : ""}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-white/25 flex-wrap">
                    <span>{new Date(post.created_at!).toLocaleString("ru", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
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
                    {post.button_text && (
                      <span className="text-blue-400/60 flex items-center gap-1">
                        <Icon name="MousePointer" size={10} />
                        {post.button_text}
                      </span>
                    )}
                  </div>
                </div>

                {/* Действия */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    onClick={() => onPublish(post)}
                    disabled={publishingId === post.id}
                    title={post.status === "published" ? "Отправить повторно" : "Опубликовать сейчас"}
                    className="w-8 h-8 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 flex items-center justify-center text-emerald-400 transition-colors disabled:opacity-40"
                  >
                    {publishingId === post.id
                      ? <div className="w-3 h-3 border border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                      : <Icon name={post.status === "published" ? "SendHorizontal" : "Send"} size={13} />}
                  </button>
                  <button
                    onClick={() => isActive ? onResetEdit() : onEdit(post)}
                    title={isActive ? "Закрыть" : "Редактировать"}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isActive ? "bg-purple-500/20 text-purple-300" : "bg-blue-500/10 hover:bg-blue-500/20 text-blue-400"}`}
                  >
                    <Icon name={isActive ? "X" : "Pencil"} size={13} />
                  </button>
                  {post.status === "published" && post.telegram_message_id && isActive && (
                    <button
                      onClick={() => onEditInTg(post)}
                      disabled={editingInTgId === post.id}
                      title="Обновить в Telegram"
                      className="w-8 h-8 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 flex items-center justify-center text-sky-400 transition-colors disabled:opacity-40"
                    >
                      {editingInTgId === post.id
                        ? <div className="w-3 h-3 border border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
                        : <Icon name="RefreshCw" size={13} />}
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(post)}
                    disabled={deleting === post.id}
                    title="Удалить"
                    className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center text-red-400 transition-colors disabled:opacity-40"
                  >
                    {deleting === post.id
                      ? <div className="w-3 h-3 border border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                      : <Icon name="Trash2" size={13} />}
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}
      </div>
      )}
    </div>
  );
}

export default PostList;