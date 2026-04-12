import { useState, useEffect } from "react";
import { ADMIN_POSTS_URL, UPLOAD_VIDEO_URL } from "./adminTypes";
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
  title: "", text: "", photo_url: "", video_note_url: "", button_text: "", button_url: "",
  button2_text: "", button2_url: "",
  status: "draft", scheduled_at: null, chat: "main",
};

export function AdminPostsTab({ token }: AdminPostsTabProps) {
  // ── форма ──
  const [form, setForm] = useState<PostFormData>({ ...EMPTY });
  const [savedForm, setSavedForm] = useState<PostFormData>({ ...EMPTY });
  const [editId, setEditId] = useState<number | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [editInTg, setEditInTg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

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

  // ── загрузка фото через S3 ──
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch(`${ADMIN_POSTS_URL}?action=upload_photo`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Admin-Token": token },
          body: JSON.stringify({ image: reader.result }),
        });
        const data = await res.json();
        if (data.ok) {
          setForm(f => ({ ...f, photo_url: data.url }));
        } else {
          setFormError("Ошибка загрузки фото: " + (data.error || "?"));
        }
      } catch {
        setFormError("Ошибка загрузки фото");
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // ── загрузка видео-кружка через presigned URL (прямо в S3) ──
  const handleVideoNoteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_MB = 50;
    if (file.size > MAX_MB * 1024 * 1024) {
      setFormError(`Видео слишком большое. Максимум ${MAX_MB} МБ (сейчас ${(file.size / 1024 / 1024).toFixed(1)} МБ)`);
      e.target.value = "";
      return;
    }

    setUploadingVideo(true);
    try {
      // 1. Получаем presigned PUT URL у бэкенда
      const presignRes = await fetch(
        `${UPLOAD_VIDEO_URL}?action=presign&filename=${encodeURIComponent(file.name)}`,
        { headers: { "X-Admin-Token": token } }
      );
      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({}));
        setFormError(`Ошибка: ${err.error || `сервер вернул ${presignRes.status}`}`);
        return;
      }
      const { upload_url, cdn_url } = await presignRes.json();

      // 2. Загружаем файл напрямую в S3 (без ограничений платформы)
      const uploadRes = await fetch(upload_url, {
        method: "PUT",
        headers: { "Content-Type": "video/mp4" },
        body: file,
      });
      if (!uploadRes.ok) {
        setFormError(`Ошибка загрузки в хранилище: ${uploadRes.status}`);
        return;
      }

      setForm(f => ({ ...f, video_note_url: cdn_url }));
    } catch {
      setFormError("Ошибка загрузки видео. Проверьте соединение.");
    } finally {
      setUploadingVideo(false);
      e.target.value = "";
    }
  };

  // ── начать редактирование поста ──
  const startEdit = (post: Post) => {
    const newForm: PostFormData = {
      title: post.title, text: post.text, photo_url: post.photo_url,
      video_note_url: post.video_note_url ?? "",
      button_text: post.button_text, button_url: post.button_url,
      button2_text: post.button2_text ?? "", button2_url: post.button2_url ?? "",
      status: post.status, scheduled_at: post.scheduled_at,
      chat: (post as PostFormData & { chat?: "main" | "kurilka" }).chat ?? "main",
    };
    setEditId(post.id);
    setForm(newForm);
    setSavedForm(newForm);
    setScheduledAt(toLocalInput(post.scheduled_at));
    setEditInTg(false);
    setFormError(""); setFormSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetForm = () => {
    setEditId(null);
    setForm({ ...EMPTY });
    setSavedForm({ ...EMPTY });
    setScheduledAt("");
    setEditInTg(false);
    setFormError(""); setFormSuccess("");
  };

  // ── сохранить черновик (без аргументов, для confirmLeave) ──
  const handleSaveDraft = async () => {
    if (!form.text.trim()) return;
    await handleSave("draft");
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
      setSavedForm({ ...form });
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

  const isDirty = form.text.trim() !== savedForm.text.trim() || form.title !== savedForm.title;

  const confirmLeave = (callback: () => void) => {
    if (!isDirty || !form.text.trim()) { callback(); return; }
    const choice = window.confirm("Есть несохранённые изменения. Сохранить черновик перед выходом?");
    if (choice) {
      handleSaveDraft().then(callback);
    } else {
      callback();
    }
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
        body: JSON.stringify({ post_id: postId, chat: form.chat }),
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
        body: JSON.stringify({ post_id: post.id, chat: form.chat }),
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
          uploadingVideo={uploadingVideo}
          formError={formError}
          formSuccess={formSuccess}
          editingPublished={!!editingPublished}
          onFormChange={patch => setForm(f => ({ ...f, ...patch }))}
          onScheduledAtChange={setScheduledAt}
          onEditInTgToggle={() => setEditInTg(v => !v)}
          onPhotoUpload={handlePhotoUpload}
          onVideoNoteUpload={handleVideoNoteUpload}
          onSave={handleSave}
          onPublishNow={handlePublishNow}
          onReset={() => confirmLeave(resetForm)}
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
          onEdit={post => confirmLeave(() => startEdit(post))}
          onDelete={handleDelete}
          onResetEdit={() => confirmLeave(resetForm)}
        />
      </div>
    </div>
  );
}

export default AdminPostsTab;