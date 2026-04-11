import { useState, useEffect } from "react";
import { ADMIN_POSTS_URL } from "./adminTypes";
import type { Post } from "./adminTypes";
import { PostForm } from "./PostForm";
import type { PostFormData } from "./PostForm";
import { PostList } from "./PostList";

interface AdminPostsTabProps {
  token: string;
}

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EMPTY: PostFormData = {
  title: "", text: "", photo_url: "", button_text: "", button_url: "",
  status: "draft", scheduled_at: null,
};

export function AdminPostsTab({ token }: AdminPostsTabProps) {
  // ── форма ──
  const [form, setForm] = useState<PostFormData>({ ...EMPTY });
  const [editId, setEditId] = useState<number | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [editInTg, setEditInTg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [uploading, setUploading] = useState(false);

  // ── список ──
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);
  const [publishingId, setPublishingId] = useState<number | null>(null);

  const fetchPosts = async (sf = statusFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (sf) params.set("status", sf);
      const res = await fetch(`${ADMIN_POSTS_URL}?${params}`, { headers: { "X-Admin-Token": token } });
      const data = await res.json();
      if (data.ok) { setPosts(data.posts); setTotal(data.total); }
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchPosts(statusFilter); }, [statusFilter]);

  // ── загрузка фото ──
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setForm(f => ({ ...f, photo_url: reader.result as string }));
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  // ── начать редактирование поста ──
  const startEdit = (post: Post) => {
    setEditId(post.id);
    setForm({
      title: post.title, text: post.text, photo_url: post.photo_url,
      button_text: post.button_text, button_url: post.button_url,
      status: post.status, scheduled_at: post.scheduled_at,
    });
    setScheduledAt(toLocalInput(post.scheduled_at));
    setEditInTg(false);
    setFormError(""); setFormSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetForm = () => {
    setEditId(null);
    setForm({ ...EMPTY });
    setScheduledAt("");
    setEditInTg(false);
    setFormError(""); setFormSuccess("");
  };

  // ── сохранить черновик / запланировать ──
  const handleSave = async (saveStatus: "draft" | "scheduled") => {
    if (!form.text.trim()) { setFormError("Введите текст поста"); return; }
    if (saveStatus === "scheduled" && !scheduledAt) { setFormError("Укажите дату и время публикации"); return; }
    setSaving(true); setFormError(""); setFormSuccess("");
    try {
      const payload: Record<string, unknown> = {
        ...form,
        status: saveStatus,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        ...(editId ? { id: editId, edit_in_telegram: editInTg } : {}),
      };
      const res = await fetch(ADMIN_POSTS_URL, {
        method: editId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Ошибка");
      setFormSuccess(saveStatus === "scheduled" ? "Пост запланирован!" : "Черновик сохранён!");
      setPosts(prev => {
        const idx = prev.findIndex(p => p.id === data.post.id);
        return idx >= 0 ? prev.map(p => p.id === data.post.id ? data.post : p) : [data.post, ...prev];
      });
      if (!editId) { setTotal(t => t + 1); resetForm(); }
      else setEditId(data.post.id);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Ошибка");
    } finally { setSaving(false); }
  };

  // ── опубликовать сейчас из формы ──
  const handlePublishNow = async () => {
    if (!form.text.trim()) { setFormError("Введите текст поста"); return; }
    setPublishing(true); setFormError(""); setFormSuccess("");
    try {
      const savePayload: Record<string, unknown> = {
        ...form, status: "draft", scheduled_at: null,
        ...(editId ? { id: editId } : {}),
      };
      const saveRes = await fetch(ADMIN_POSTS_URL, {
        method: editId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify(savePayload),
      });
      const saveData = await saveRes.json();
      if (!saveData.ok) throw new Error(saveData.error || "Ошибка сохранения");
      const postId = saveData.post.id;

      const pubRes = await fetch(`${ADMIN_POSTS_URL}?action=publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify({ post_id: postId }),
      });
      const pubData = await pubRes.json();
      if (!pubData.ok) throw new Error(pubData.error || "Ошибка публикации");

      setFormSuccess("✅ Пост опубликован в канал!");
      const updatedPost = { ...saveData.post, status: "published" as const, published_at: new Date().toISOString(), telegram_message_id: pubData.message_id };
      setPosts(prev => {
        const idx = prev.findIndex(p => p.id === postId);
        return idx >= 0 ? prev.map(p => p.id === postId ? updatedPost : p) : [updatedPost, ...prev];
      });
      if (!editId) { setTotal(t => t + 1); resetForm(); }
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Ошибка публикации");
    } finally { setPublishing(false); }
  };

  // ── опубликовать из списка ──
  const handlePublishFromList = async (post: Post) => {
    setPublishingId(post.id);
    try {
      const res = await fetch(`${ADMIN_POSTS_URL}?action=publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify({ post_id: post.id }),
      });
      const data = await res.json();
      if (data.ok) {
        setPosts(prev => prev.map(p => p.id === post.id
          ? { ...p, status: "published", published_at: new Date().toISOString(), telegram_message_id: data.message_id }
          : p));
      } else { alert("Ошибка: " + (data.error || "?")); }
    } finally { setPublishingId(null); }
  };

  const handleDelete = async (post: Post) => {
    if (!confirm(`Удалить пост?`)) return;
    setDeleting(post.id);
    try {
      await fetch(ADMIN_POSTS_URL, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify({ id: post.id }),
      });
      setPosts(prev => prev.filter(p => p.id !== post.id));
      setTotal(t => t - 1);
      if (editId === post.id) resetForm();
    } finally { setDeleting(null); }
  };

  const editingPublished = editId !== null && posts.find(p => p.id === editId)?.status === "published";

  return (
    <div>
      <h2 className="font-oswald text-3xl font-bold text-white mb-6">
        Посты в канал <span className="text-muted-foreground text-xl">({total})</span>
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <PostForm
          form={form}
          editId={editId}
          scheduledAt={scheduledAt}
          editInTg={editInTg}
          saving={saving}
          publishing={publishing}
          uploading={uploading}
          formError={formError}
          formSuccess={formSuccess}
          editingPublished={!!editingPublished}
          onFormChange={patch => setForm(f => ({ ...f, ...patch }))}
          onScheduledAtChange={setScheduledAt}
          onEditInTgToggle={() => setEditInTg(v => !v)}
          onPhotoUpload={handlePhotoUpload}
          onSave={handleSave}
          onPublishNow={handlePublishNow}
          onReset={resetForm}
        />

        <PostList
          posts={posts}
          loading={loading}
          statusFilter={statusFilter}
          editId={editId}
          publishingId={publishingId}
          deleting={deleting}
          onFilterChange={sf => setStatusFilter(sf)}
          onRefresh={() => fetchPosts(statusFilter)}
          onPublish={handlePublishFromList}
          onEdit={startEdit}
          onDelete={handleDelete}
          onResetEdit={resetForm}
        />
      </div>
    </div>
  );
}

export default AdminPostsTab;
