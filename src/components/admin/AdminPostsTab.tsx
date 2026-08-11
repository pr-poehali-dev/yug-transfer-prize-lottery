import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { ADMIN_POSTS_URL } from "./adminTypes";
import type { Post } from "./adminTypes";
import { PostForm } from "./PostForm";
import type { PostFormData } from "./PostForm";
import { PostList } from "./PostList";

interface AdminPostsTabProps {
  token: string;
  onTotalChange?: (n: number) => void;
  expanded?: boolean;
  onToggle?: () => void;
}

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EMPTY: PostFormData = {
  title: "", text: "", photo_url: "", button_text: "", button_url: "",
  button2_text: "", button2_url: "",
  status: "draft", scheduled_at: null, chats: "main,vip",
};

export function AdminPostsTab({ token, onTotalChange, expanded: controlledExpanded, onToggle }: AdminPostsTabProps) {
  // ── форма ──
  const [form, setForm] = useState<PostFormData>({ ...EMPTY });
  const [savedForm, setSavedForm] = useState<PostFormData>({ ...EMPTY });
  const [editId, setEditId] = useState<number | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [expireHours, setExpireHours] = useState(0);
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
  const [editingInTgId, setEditingInTgId] = useState<number | null>(null);
  const [localExpanded, setLocalExpanded] = useState(false);
  const formExpanded = controlledExpanded ?? localExpanded;
  const toggleExpanded = onToggle ?? (() => setLocalExpanded(v => !v));

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
  useEffect(() => { onTotalChange?.(total); }, [total, onTotalChange]);

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

  // ── начать редактирование поста ──
  const startEdit = (post: Post) => {
    const newForm: PostFormData = {
      title: post.title, text: post.text, photo_url: post.photo_url,
      button_text: post.button_text, button_url: post.button_url,
      button2_text: post.button2_text ?? "", button2_url: post.button2_url ?? "",
      status: post.status, scheduled_at: post.scheduled_at,
      chats: "main,vip",
    };
    setEditId(post.id);
    setForm(newForm);
    setSavedForm(newForm);
    setScheduledAt(toLocalInput(post.scheduled_at));
    // вычисляем срок автоудаления в часах относительно публикации/планирования
    if (post.auto_expire_at) {
      const base = post.scheduled_at || post.published_at || post.created_at;
      const hrs = base
        ? Math.round((new Date(post.auto_expire_at).getTime() - new Date(base).getTime()) / 3600000)
        : 0;
      setExpireHours(hrs > 0 ? hrs : 0);
    } else {
      setExpireHours(0);
    }
    setEditInTg(false);
    setFormError(""); setFormSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetForm = () => {
    setEditId(null);
    setForm({ ...EMPTY });
    setSavedForm({ ...EMPTY });
    setScheduledAt("");
    setExpireHours(0);
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
        expire_hours: expireHours || 0,
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
        body: JSON.stringify({ post_id: postId, expire_hours: expireHours || 0, chats: "main,vip" }),
      });
      const pubData = await pubRes.json();
      if (!pubData.ok) throw new Error(pubData.error || "Ошибка публикации");

      setFormSuccess("✅ Пост опубликован!");
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
        body: JSON.stringify({ post_id: post.id, chats: "main,vip" }),
      });
      const data = await res.json();
      if (data.ok) {
        setPosts(prev => prev.map(p => p.id === post.id
          ? { ...p, status: "published", published_at: new Date().toISOString() }
          : p));
      } else {
        alert("Ошибка: " + (data.error || "?"));
      }
    } finally { setPublishingId(null); }
  };

  const handleDelete = async (post: Post) => {
    const msg = post.status === "published"
      ? "Удалить пост из Telegram и из базы?"
      : "Удалить пост?";
    if (!confirm(msg)) return;
    setDeleting(post.id);
    try {
      const res = await fetch(ADMIN_POSTS_URL, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify({ id: post.id }),
      });
      const data = await res.json();
      setPosts(prev => prev.filter(p => p.id !== post.id));
      setTotal(t => t - 1);
      if (editId === post.id) resetForm();
      if (post.status === "published" && data.tg_deleted) {
        setFormSuccess("Пост удалён из Telegram и из базы");
      }
    } finally { setDeleting(null); }
  };

  const handleEditInTg = async (post: Post) => {
    if (!editId || editId !== post.id) return;
    setEditingInTgId(post.id);
    setFormError(""); setFormSuccess("");
    try {
      const payload = { ...form, id: post.id, status: post.status, edit_in_telegram: true };
      const res = await fetch(ADMIN_POSTS_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Ошибка");
      setFormSuccess("Пост обновлён в Telegram!");
      setSavedForm({ ...form });
      setPosts(prev => prev.map(p => p.id === data.post.id ? data.post : p));
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Ошибка обновления в Telegram");
    } finally { setEditingInTgId(null); }
  };

  const editingPublished = editId !== null && posts.find(p => p.id === editId)?.status === "published";

  return (
    <div className="card-glow rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/10"
      >
        <div className="flex items-center gap-2">
          <Icon name="Send" size={15} className="text-purple-400" />
          <span className="text-sm font-medium text-white">Посты в канал</span>
          <span className="text-[11px] text-white/40">· {posts.length}</span>
        </div>
        <Icon
          name="ChevronDown"
          size={16}
          className={`text-white/50 transition-transform ${formExpanded ? "rotate-180" : ""}`}
        />
      </button>

      {formExpanded && (
        <div className="p-4 space-y-4">
          <PostForm
            form={form}
            editId={editId}
            scheduledAt={scheduledAt}
            expireHours={expireHours}
            editInTg={editInTg}
            saving={saving}
            publishing={publishing}
            uploading={uploading}
            formError={formError}
            formSuccess={formSuccess}
            editingPublished={!!editingPublished}
            onFormChange={patch => setForm(f => ({ ...f, ...patch }))}
            onScheduledAtChange={setScheduledAt}
            onExpireHoursChange={setExpireHours}
            onEditInTgToggle={() => setEditInTg(v => !v)}
            onPhotoUpload={handlePhotoUpload}
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
            editingInTgId={editingInTgId}
            onFilterChange={sf => setStatusFilter(sf)}
            onRefresh={() => fetchPosts(statusFilter)}
            onPublish={handlePublishFromList}
            onEditInTg={handleEditInTg}
            onEdit={post => confirmLeave(() => startEdit(post))}
            onDelete={handleDelete}
            onResetEdit={() => confirmLeave(resetForm)}
          />
        </div>
      )}
    </div>
  );
}

export default AdminPostsTab;