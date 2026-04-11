import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import { ADMIN_POSTS_URL } from "./adminTypes";
import type { Post } from "./adminTypes";

interface AdminPostsTabProps {
  token: string;
}

const STATUS_CFG = {
  draft:     { label: "Черновик",      color: "text-white/50",    bg: "bg-white/5 border-white/10",               dot: "bg-white/30" },
  scheduled: { label: "Запланирован",  color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/20",    dot: "bg-purple-400" },
  published: { label: "Опубликован",   color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20",  dot: "bg-emerald-400" },
  failed:    { label: "Ошибка",        color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20",          dot: "bg-red-400" },
};

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EMPTY: Omit<Post, "id" | "created_at" | "updated_at" | "published_at" | "telegram_message_id"> = {
  title: "", text: "", photo_url: "", button_text: "", button_url: "",
  status: "draft", scheduled_at: null,
};

export function AdminPostsTab({ token }: AdminPostsTabProps) {
  // ── форма ──
  const [form, setForm] = useState({ ...EMPTY });
  const [editId, setEditId] = useState<number | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [editInTg, setEditInTg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
      // Просто ставим data-url как превью, реальный URL будет при сохранении
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
      // Сначала сохраняем
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

      // Публикуем
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

  const strip = (html: string) => html.replace(/<[^>]+>/g, "");

  const editingPublished = editId !== null && posts.find(p => p.id === editId)?.status === "published";

  return (
    <div>
      <h2 className="font-oswald text-3xl font-bold text-white mb-6">
        Посты в канал <span className="text-muted-foreground text-xl">({total})</span>
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* ═══ ЛЕВАЯ КОЛОНКА — ФОРМА ═══ */}
        <div className="card-glow rounded-3xl overflow-hidden">
          {/* Шапка формы */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                <Icon name={editId ? "Pencil" : "Plus"} size={15} className="text-white" />
              </div>
              <p className="text-white font-semibold text-sm">{editId ? "Редактировать пост" : "Новый пост"}</p>
            </div>
            {editId && (
              <button onClick={resetForm} className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1">
                <Icon name="X" size={13} /> Отмена
              </button>
            )}
          </div>

          <div className="p-5 space-y-4">
            {/* Название */}
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">Название <span className="text-white/20">(для архива)</span></label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Название поста..."
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none placeholder-white/20"
              />
            </div>

            {/* Текст */}
            <div>
              <label className="text-xs text-white/50 mb-1.5 flex justify-between">
                <span>Текст поста <span className="text-red-400">*</span></span>
                <span className={form.text.length > 3600 ? "text-red-400" : "text-white/20"}>{form.text.length}/4096</span>
              </label>
              <textarea
                value={form.text}
                onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
                placeholder={"Текст сообщения...\n\nПоддерживается HTML:\n<b>жирный</b>, <i>курсив</i>\n<a href='https://...'>ссылка</a>"}
                rows={6}
                maxLength={4096}
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none resize-none font-mono leading-relaxed placeholder-white/20"
              />
            </div>

            {/* Фото */}
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">Фото <span className="text-white/20">(необязательно)</span></label>
              {form.photo_url ? (
                <div className="relative rounded-xl overflow-hidden border border-white/10">
                  <img src={form.photo_url} alt="" className="w-full max-h-44 object-cover" />
                  <button
                    onClick={() => setForm(f => ({ ...f, photo_url: "" }))}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                  >
                    <Icon name="X" size={13} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full h-24 rounded-xl border-2 border-dashed border-white/10 hover:border-purple-500/40 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-white transition-colors"
                >
                  {uploading
                    ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    : <><Icon name="ImagePlus" size={20} /><span className="text-xs">Загрузить фото</span></>}
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </div>

            {/* Кнопка */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Кнопка — текст</label>
                <input
                  value={form.button_text}
                  onChange={e => setForm(f => ({ ...f, button_text: e.target.value }))}
                  placeholder="Подробнее →"
                  className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none placeholder-white/20"
                />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Кнопка — ссылка</label>
                <input
                  value={form.button_url}
                  onChange={e => setForm(f => ({ ...f, button_url: e.target.value }))}
                  placeholder="https://ug-gift.ru"
                  className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none placeholder-white/20"
                />
              </div>
            </div>

            {/* Расписание */}
            <div className="rounded-2xl bg-purple-500/5 border border-purple-500/15 p-4 space-y-2">
              <p className="text-xs text-purple-300 flex items-center gap-1.5 font-medium">
                <Icon name="Calendar" size={13} /> Расписание публикации
              </p>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none [color-scheme:dark]"
              />
              {scheduledAt && (
                <p className="text-xs text-purple-400">
                  Пост выйдет {new Date(scheduledAt).toLocaleString("ru", { day:"2-digit", month:"long", hour:"2-digit", minute:"2-digit" })}
                </p>
              )}
            </div>

            {/* Тоггл "редактировать в TG" для опубликованных */}
            {editingPublished && (
              <button
                onClick={() => setEditInTg(v => !v)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${editInTg ? "border-orange-500/30 bg-orange-500/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
              >
                <Icon name="Edit3" size={15} className={editInTg ? "text-orange-400" : "text-muted-foreground"} />
                <div className="flex-1">
                  <p className={`text-sm font-medium ${editInTg ? "text-orange-300" : "text-white"}`}>Изменить текст в Telegram</p>
                  <p className="text-xs text-muted-foreground">Отредактирует уже опубликованное сообщение</p>
                </div>
                <div className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 shrink-0 ${editInTg ? "bg-orange-500" : "bg-white/10"}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${editInTg ? "translate-x-4" : ""}`} />
                </div>
              </button>
            )}

            {/* Ошибка / успех */}
            {formError && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                <Icon name="AlertCircle" size={14} /> {formError}
              </div>
            )}
            {formSuccess && (
              <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5">
                <Icon name="CheckCircle2" size={14} /> {formSuccess}
              </div>
            )}

            {/* Кнопки действий */}
            <div className="flex gap-2 pt-1 flex-wrap">
              <button
                onClick={() => handleSave("draft")}
                disabled={saving || publishing}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Icon name="FileText" size={14} />
                {editId ? "Сохранить" : "Черновик"}
              </button>

              {scheduledAt && (
                <button
                  onClick={() => handleSave("scheduled")}
                  disabled={saving || publishing}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Icon name="Clock" size={14} />
                  Запланировать
                </button>
              )}

              <button
                onClick={handlePublishNow}
                disabled={saving || publishing}
                className="flex-1 grad-btn py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {publishing
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Публикую...</>
                  : <><Icon name="Send" size={14} />Опубликовать</>}
              </button>
            </div>
          </div>
        </div>

        {/* ═══ ПРАВАЯ КОЛОНКА — СПИСОК ПОСТОВ ═══ */}
        <div className="space-y-3">
          {/* Фильтры */}
          <div className="flex gap-1.5 flex-wrap">
            {(["", "draft", "scheduled", "published"] as const).map(key => {
              const labels = { "": "Все", draft: "Черновики", scheduled: "По расписанию", published: "Опубликованные" };
              return (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === key ? "bg-purple-600 text-white" : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"}`}
                >
                  {labels[key]}
                </button>
              );
            })}
            <button
              onClick={() => fetchPosts(statusFilter)}
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
                        <span>{new Date(post.created_at!).toLocaleString("ru", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })}</span>
                        {post.scheduled_at && (
                          <span className="text-purple-400/80 flex items-center gap-1">
                            <Icon name="Clock" size={10} />
                            {new Date(post.scheduled_at).toLocaleString("ru", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })}
                          </span>
                        )}
                        {post.published_at && (
                          <span className="text-emerald-400/70 flex items-center gap-1">
                            <Icon name="CheckCircle2" size={10} />
                            {new Date(post.published_at).toLocaleString("ru", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })}
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
                      {post.status !== "published" && (
                        <button
                          onClick={() => handlePublishFromList(post)}
                          disabled={publishingId === post.id}
                          title="Опубликовать сейчас"
                          className="w-8 h-8 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 flex items-center justify-center text-emerald-400 transition-colors disabled:opacity-40"
                        >
                          {publishingId === post.id
                            ? <div className="w-3 h-3 border border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                            : <Icon name="Send" size={13} />}
                        </button>
                      )}
                      <button
                        onClick={() => isActive ? resetForm() : startEdit(post)}
                        title={isActive ? "Закрыть" : "Редактировать"}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isActive ? "bg-purple-500/20 text-purple-300" : "bg-blue-500/10 hover:bg-blue-500/20 text-blue-400"}`}
                      >
                        <Icon name={isActive ? "X" : "Pencil"} size={13} />
                      </button>
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
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminPostsTab;
