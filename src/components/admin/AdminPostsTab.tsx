import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { ADMIN_POSTS_URL } from "./adminTypes";
import type { Post } from "./adminTypes";
import { PostFormModal } from "./PostFormModal";

interface AdminPostsTabProps {
  token: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  draft:     { label: "Черновик",    color: "text-white/40 bg-white/5 border-white/10",         icon: "FileText" },
  scheduled: { label: "Запланирован", color: "text-purple-400 bg-purple-500/10 border-purple-500/20", icon: "Clock" },
  published: { label: "Опубликован",  color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: "CheckCircle2" },
  failed:    { label: "Ошибка",       color: "text-red-400 bg-red-500/10 border-red-500/20",    icon: "AlertCircle" },
};

const FILTER_TABS = [
  { key: "", label: "Все" },
  { key: "draft", label: "Черновики" },
  { key: "scheduled", label: "Запланированные" },
  { key: "published", label: "Опубликованные" },
];

export function AdminPostsTab({ token }: AdminPostsTabProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Post | undefined>();
  const [publishing, setPublishing] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);

  const fetchPosts = useCallback(async (p = 1, sf = statusFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "20" });
      if (sf) params.set("status", sf);
      const res = await fetch(`${ADMIN_POSTS_URL}?${params}`, { headers: { "X-Admin-Token": token } });
      const data = await res.json();
      if (data.ok) {
        setPosts(data.posts);
        setTotal(data.total);
        setPage(data.page);
        setPages(data.pages);
      }
    } finally { setLoading(false); }
  }, [token, statusFilter]);

  useEffect(() => { fetchPosts(1, statusFilter); }, [statusFilter]);

  const handlePublish = async (post: Post) => {
    if (!confirm(`Опубликовать пост "${post.title || post.text.slice(0, 40) + "..."}" прямо сейчас?`)) return;
    setPublishing(post.id);
    try {
      const res = await fetch(`${ADMIN_POSTS_URL}?action=publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify({ post_id: post.id }),
      });
      const data = await res.json();
      if (data.ok) {
        setPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: "published", published_at: new Date().toISOString(), telegram_message_id: data.message_id } : p));
      } else { alert("Ошибка: " + (data.error || "Неизвестная ошибка")); }
    } finally { setPublishing(null); }
  };

  const handleDelete = async (post: Post) => {
    if (!confirm(`Удалить пост "${post.title || post.text.slice(0, 40)}"?`)) return;
    setDeleting(post.id);
    try {
      await fetch(ADMIN_POSTS_URL, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify({ id: post.id }),
      });
      setPosts(prev => prev.filter(p => p.id !== post.id));
      setTotal(t => t - 1);
    } finally { setDeleting(null); }
  };

  const handleCheckScheduled = async () => {
    setChecking(true);
    try {
      const res = await fetch(`${ADMIN_POSTS_URL}?action=check_scheduled`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.ok && data.published?.length > 0) {
        fetchPosts(page, statusFilter);
      }
    } finally { setChecking(false); }
  };

  const handleSave = (post: Post) => {
    setPosts(prev => {
      const idx = prev.findIndex(p => p.id === post.id);
      return idx >= 0 ? prev.map(p => p.id === post.id ? post : p) : [post, ...prev];
    });
    if (!editTarget) setTotal(t => t + 1);
    setFormOpen(false);
    setEditTarget(undefined);
  };

  const previewText = (text: string, max = 120) =>
    text.replace(/<[^>]+>/g, "").slice(0, max) + (text.length > max ? "…" : "");

  return (
    <div>
      {formOpen && (
        <PostFormModal
          initial={editTarget}
          token={token}
          onSave={handleSave}
          onClose={() => { setFormOpen(false); setEditTarget(undefined); }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <h2 className="font-oswald text-3xl font-bold text-white">
          Посты <span className="text-muted-foreground text-xl">({total})</span>
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCheckScheduled}
            disabled={checking}
            title="Проверить и опубликовать запланированные посты"
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-white transition-colors disabled:opacity-40"
          >
            {checking
              ? <div className="w-4 h-4 border border-white/20 border-t-white rounded-full animate-spin" />
              : <Icon name="RefreshCw" size={15} />}
          </button>
          <button
            onClick={() => { setEditTarget(undefined); setFormOpen(true); }}
            className="grad-btn px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2"
          >
            <Icon name="Plus" size={15} />
            Новый пост
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {FILTER_TABS.map(ft => (
          <button
            key={ft.key}
            onClick={() => setStatusFilter(ft.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === ft.key ? "bg-purple-600 text-white" : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white"}`}
          >
            {ft.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Icon name="Send" size={48} className="mx-auto mb-3 opacity-20" />
          <p className="mb-4">{statusFilter ? "Нет постов с таким статусом" : "Постов пока нет"}</p>
          <button
            onClick={() => { setEditTarget(undefined); setFormOpen(true); }}
            className="grad-btn px-5 py-2.5 rounded-xl text-sm font-semibold"
          >
            Создать первый пост
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-3 mb-4">
            {posts.map(post => {
              const st = STATUS_LABELS[post.status] || STATUS_LABELS.draft;
              return (
                <div key={post.id} className="card-glow rounded-2xl p-4 flex gap-3">

                  {/* Photo preview */}
                  {post.photo_url ? (
                    <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-white/10">
                      <img src={post.photo_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      <Icon name="Image" size={20} className="text-white/20" />
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-1 flex-wrap">
                      {post.title && (
                        <p className="text-white font-semibold text-sm truncate max-w-xs">{post.title}</p>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 shrink-0 ${st.color}`}>
                        <Icon name={st.icon as Parameters<typeof Icon>[0]["name"]} size={11} />
                        {st.label}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2 mb-2">
                      {previewText(post.text)}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-white/30 flex-wrap">
                      <span>Создан: {new Date(post.created_at!).toLocaleString("ru", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                      {post.scheduled_at && (
                        <span className="text-purple-400">
                          📅 {new Date(post.scheduled_at).toLocaleString("ru", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                      {post.published_at && (
                        <span className="text-emerald-400/70">
                          ✓ {new Date(post.published_at).toLocaleString("ru", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                      {post.button_text && (
                        <span className="text-blue-400/70 flex items-center gap-1">
                          <Icon name="MousePointer" size={10} />
                          {post.button_text}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 shrink-0">
                    {/* Publish now — only for draft/scheduled/failed */}
                    {post.status !== "published" && (
                      <button
                        onClick={() => handlePublish(post)}
                        disabled={publishing === post.id}
                        title="Опубликовать сейчас"
                        className="w-8 h-8 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 flex items-center justify-center text-emerald-400 transition-colors disabled:opacity-40"
                      >
                        {publishing === post.id
                          ? <div className="w-3 h-3 border border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                          : <Icon name="Send" size={13} />}
                      </button>
                    )}
                    {/* Edit */}
                    <button
                      onClick={() => { setEditTarget(post); setFormOpen(true); }}
                      title="Редактировать"
                      className="w-8 h-8 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 flex items-center justify-center text-blue-400 transition-colors"
                    >
                      <Icon name="Pencil" size={13} />
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(post)}
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
              );
            })}
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button disabled={page <= 1} onClick={() => fetchPosts(page - 1)}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white disabled:opacity-30 transition-colors">
                <Icon name="ChevronLeft" size={16} />
              </button>
              <span className="text-sm text-muted-foreground">стр. {page} из {pages}</span>
              <button disabled={page >= pages} onClick={() => fetchPosts(page + 1)}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white disabled:opacity-30 transition-colors">
                <Icon name="ChevronRight" size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default AdminPostsTab;
