import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import { ADMIN_BOT_POSTS_URL, ADMIN_POSTS_URL, SAIT_BOT_DAILY_URL } from "./adminTypes";

interface AdminBotTabProps {
  token: string;
}

interface BotPost {
  id: number;
  photo_url: string;
  greeting: string;
  description: string;
  is_used: boolean;
  scheduled_date: string | null;
  created_at: string;
}

const BOTS = [
  {
    id: "gift",
    name: "Бот розыгрышей",
    url: "https://functions.poehali.dev/0a298490-7238-4089-bc1d-34880245c186",
    color: "sky",
    icon: "Gift",
    description: "Привязка аккаунта, уведомления о розыгрышах",
    features: [
      { label: "Привязка Telegram к аккаунту", active: true },
      { label: "Уведомления о розыгрышах", active: true },
      { label: "Посты в канал", active: true },
    ],
  },
  {
    id: "site",
    name: "Бот сайта",
    url: "https://functions.poehali.dev/1fa0fa06-91b0-4358-aad7-f62d5aafa444",
    color: "purple",
    icon: "Globe",
    description: "Открывает ug-transfer.online внутри Telegram",
    features: [
      { label: "Web App — сайт внутри Telegram", active: true },
      { label: "Кнопка меню «Открыть сайт»", active: true },
      { label: "Ежедневные посты в @ug_transfer_pro", active: true },
    ],
  },
];

interface BotInfo {
  username: string;
  webhookStatus: "loading" | "active" | "not_set" | "error";
  loading: boolean;
}

export function AdminBotTab({ token }: AdminBotTabProps) {
  const [bots, setBots] = useState<Record<string, BotInfo>>({
    gift: { username: "", webhookStatus: "loading", loading: true },
    site: { username: "", webhookStatus: "loading", loading: true },
  });
  const [posts, setPosts] = useState<BotPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ photo_url: "", greeting: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
        if (data.ok) setForm(f => ({ ...f, photo_url: data.url }));
      } catch { /* */ }
      setUploading(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const fetchBotInfo = async (botId: string, url: string) => {
    try {
      const res = await fetch(`${url}?action=bot_info`, { headers: { "X-Admin-Token": token } });
      const data = await res.json();
      setBots(prev => ({
        ...prev,
        [botId]: {
          username: data.ok ? data.username : "",
          webhookStatus: data.ok && data.webhook_active ? "active" : data.ok ? "not_set" : "error",
          loading: false,
        },
      }));
    } catch {
      setBots(prev => ({ ...prev, [botId]: { username: "", webhookStatus: "error", loading: false } }));
    }
  };

  const handleSetWebhook = async (botId: string, url: string) => {
    setBots(prev => ({ ...prev, [botId]: { ...prev[botId], webhookStatus: "loading" } }));
    try {
      const res = await fetch(`${url}?action=set_webhook&url=${encodeURIComponent(url)}`, { headers: { "X-Admin-Token": token } });
      const data = await res.json();
      setBots(prev => ({ ...prev, [botId]: { ...prev[botId], webhookStatus: data.ok ? "active" : "error" } }));
    } catch {
      setBots(prev => ({ ...prev, [botId]: { ...prev[botId], webhookStatus: "error" } }));
    }
  };

  const fetchPosts = async () => {
    try {
      const res = await fetch(ADMIN_BOT_POSTS_URL, { headers: { "X-Admin-Token": token } });
      const data = await res.json();
      if (data.ok) setPosts(data.posts || []);
    } catch { /* */ }
    setLoadingPosts(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const method = editingId ? "PUT" : "POST";
      const body = editingId ? { id: editingId, ...form } : form;
      await fetch(ADMIN_BOT_POSTS_URL, {
        method,
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify(body),
      });
      setEditingId(null);
      setShowAdd(false);
      setForm({ photo_url: "", greeting: "", description: "" });
      fetchPosts();
    } catch { /* */ }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Удалить этот пост?")) return;
    await fetch(`${ADMIN_BOT_POSTS_URL}?id=${id}`, {
      method: "DELETE",
      headers: { "X-Admin-Token": token },
    });
    fetchPosts();
  };

  const handleEdit = (post: BotPost) => {
    setEditingId(post.id);
    setShowAdd(true);
    setForm({ photo_url: post.photo_url, greeting: post.greeting, description: post.description });
  };

  const handleSendNow = async () => {
    setSending(true);
    try {
      const res = await fetch(SAIT_BOT_DAILY_URL);
      const data = await res.json();
      if (data.ok) {
        alert("Пост отправлен в @ug_transfer_pro!");
        fetchPosts();
      } else {
        alert("Ошибка отправки. Проверьте, что бот — админ группы.");
      }
    } catch {
      alert("Ошибка соединения");
    }
    setSending(false);
  };

  useEffect(() => {
    BOTS.forEach(b => fetchBotInfo(b.id, b.url));
    fetchPosts();
  }, []);

  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    sky: { bg: "bg-sky-500/10", text: "text-sky-400", border: "border-sky-500/20" },
    purple: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
  };

  const unusedCount = posts.filter(p => !p.is_used).length;

  return (
    <div className="space-y-8">
      <h2 className="font-oswald text-3xl font-bold text-white">Наши боты</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {BOTS.map(bot => {
          const info = bots[bot.id];
          const c = colorMap[bot.color];
          return (
            <div key={bot.id} className="space-y-4">
              <div className="rounded-2xl border border-white/8 p-5" style={{ background: "rgba(255,255,255,0.02)" }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
                    <Icon name={bot.icon} size={20} className={c.text} />
                  </div>
                  <div>
                    <h3 className="text-white font-medium">{bot.name}</h3>
                    <p className="text-white/40 text-xs">{bot.description}</p>
                  </div>
                </div>
                {info.loading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-white/3 border border-white/5">
                      <span className="text-white/50 text-sm">Юзернейм</span>
                      {info.username ? (
                        <a href={`https://t.me/${info.username}`} target="_blank" rel="noreferrer" className={`${c.text} text-sm font-medium hover:underline`}>@{info.username}</a>
                      ) : (
                        <span className="text-white/30 text-sm">Не настроен</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-white/3 border border-white/5">
                      <span className="text-white/50 text-sm">Webhook</span>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${info.webhookStatus === "active" ? "bg-emerald-400" : info.webhookStatus === "error" ? "bg-red-400" : "bg-white/20"}`} />
                        <span className={`text-sm ${info.webhookStatus === "active" ? "text-emerald-400" : info.webhookStatus === "error" ? "text-red-400" : "text-white/30"}`}>
                          {info.webhookStatus === "active" ? "Активен" : info.webhookStatus === "error" ? "Ошибка" : info.webhookStatus === "loading" ? "..." : "Не установлен"}
                        </span>
                      </div>
                    </div>
                    {info.webhookStatus !== "active" && info.webhookStatus !== "loading" && (
                      <button onClick={() => handleSetWebhook(bot.id, bot.url)} className={`w-full py-2.5 rounded-xl ${c.bg} hover:opacity-80 ${c.text} text-sm font-medium transition-colors border ${c.border}`}>
                        Установить Webhook
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="rounded-2xl border border-white/8 p-5" style={{ background: "rgba(255,255,255,0.02)" }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
                    <Icon name="Zap" size={16} className={c.text} />
                  </div>
                  <span className="text-white/70 text-sm font-medium">Возможности</span>
                </div>
                <div className="space-y-2">
                  {bot.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-white/3 border border-white/5">
                      <Icon name={f.active ? "CheckCircle2" : "Circle"} size={14} className={f.active ? "text-emerald-400" : "text-white/15"} />
                      <span className={`text-sm ${f.active ? "text-white/70" : "text-white/30"}`}>{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-white/8 p-6" style={{ background: "rgba(255,255,255,0.02)" }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <Icon name="Calendar" size={20} className="text-orange-400" />
            </div>
            <div>
              <h3 className="text-white font-medium text-lg">Ежедневные посты</h3>
              <p className="text-white/40 text-xs">Автопубликация в @ug_transfer_pro · Осталось: {unusedCount} из {posts.length}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSendNow} disabled={sending} className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium hover:opacity-80 transition-colors disabled:opacity-50">
              {sending ? "Отправка..." : "Отправить сейчас"}
            </button>
            <button onClick={() => { setShowAdd(true); setEditingId(null); setForm({ photo_url: "", greeting: "", description: "" }); }} className="px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-medium hover:opacity-80 transition-colors">
              <Icon name="Plus" size={16} className="inline mr-1" />Добавить
            </button>
          </div>
        </div>

        {showAdd && (
          <div className="mb-6 p-5 rounded-xl border border-purple-500/20 bg-purple-500/5 space-y-4">
            <h4 className="text-white font-medium">{editingId ? "Редактировать пост" : "Новый пост"}</h4>
            <div>
              <label className="text-white/50 text-xs mb-1 block">Фото</label>
              <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              {form.photo_url ? (
                <div className="flex items-center gap-3">
                  <img src={form.photo_url} alt="" className="w-20 h-20 object-cover rounded-xl border border-white/10" />
                  <div className="flex flex-col gap-1.5">
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 text-xs hover:bg-white/10 transition-colors disabled:opacity-50">
                      {uploading ? "Загрузка..." : "Заменить"}
                    </button>
                    <button type="button" onClick={() => setForm(f => ({ ...f, photo_url: "" }))} className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs hover:bg-red-500/20 transition-colors">
                      Удалить
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full py-8 rounded-xl border-2 border-dashed border-white/10 hover:border-purple-500/40 bg-white/[0.02] hover:bg-white/[0.04] transition-all flex flex-col items-center gap-2 disabled:opacity-50">
                  {uploading ? (
                    <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                  ) : (
                    <Icon name="ImagePlus" size={28} className="text-white/20" />
                  )}
                  <span className="text-white/40 text-xs">{uploading ? "Загрузка..." : "Нажмите для загрузки фото"}</span>
                </button>
              )}
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">Заголовок</label>
              <input value={form.greeting} onChange={e => setForm(f => ({ ...f, greeting: e.target.value }))} placeholder="🚕 Нужно такси?" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-purple-500/40" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">Описание</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Комфортные автомобили..." rows={3} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-purple-500/40 resize-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving || !form.photo_url || !form.greeting || !form.description} className="px-4 py-2 rounded-xl bg-purple-500 text-white text-sm font-medium hover:bg-purple-600 transition-colors disabled:opacity-50">
                {saving ? "Сохранение..." : editingId ? "Сохранить" : "Добавить"}
              </button>
              <button onClick={() => { setShowAdd(false); setEditingId(null); }} className="px-4 py-2 rounded-xl bg-white/5 text-white/60 text-sm hover:bg-white/10 transition-colors">
                Отмена
              </button>
            </div>
          </div>
        )}

        {loadingPosts ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <p className="text-white/30 text-center py-8">Нет постов</p>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {posts.map(post => (
              <div key={post.id} className={`flex gap-4 p-4 rounded-xl border transition-colors ${post.is_used ? "border-white/5 bg-white/2 opacity-60" : "border-white/8 bg-white/3"}`}>
                <img src={post.photo_url} alt="" className="w-20 h-20 object-cover rounded-lg border border-white/10 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{post.greeting}</p>
                      <p className="text-white/50 text-xs mt-1 line-clamp-2">{post.description}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => handleEdit(post)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                        <Icon name="Pencil" size={14} className="text-white/50" />
                      </button>
                      <button onClick={() => handleDelete(post.id)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center transition-colors">
                        <Icon name="Trash2" size={14} className="text-white/50 hover:text-red-400" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    {post.is_used ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/30">Отправлен {post.scheduled_date}</span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">В очереди</span>
                    )}
                    <span className="text-white/20 text-[10px]">#{post.id}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminBotTab;