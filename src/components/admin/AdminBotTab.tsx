import { useState, useEffect, useMemo } from "react";
import { ADMIN_BOT_POSTS_URL, SAIT_BOT_DAILY_URL } from "./adminTypes";
import { BotPost } from "./bot/botTypes";
import { BotsListBlock } from "./bot/BotsListBlock";
import { BotPostForm } from "./bot/BotPostForm";
import { BotPostsList } from "./bot/BotPostsList";
import { BotCronStatus } from "./bot/BotCronStatus";

interface AdminBotTabProps {
  token: string;
}

export function AdminBotTab({ token }: AdminBotTabProps) {
  const [posts, setPosts] = useState<BotPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ photo_url: "", greeting: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);

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
      const tgOk = !!data.tg;
      const vkOk = !!(data.vk && data.vk.ok);
      const lines: string[] = [];
      lines.push(tgOk ? "✅ Telegram: отправлено" : `❌ Telegram: ${data.tg_status || "ошибка"}`);
      lines.push(vkOk ? "✅ ВКонтакте: отправлено" : `❌ ВКонтакте: ${(data.vk && data.vk.error) || data.vk_status || "ошибка"}`);
      alert(lines.join("\n"));
      fetchPosts();
    } catch {
      alert("Ошибка соединения");
    }
    setSending(false);
  };

  const handleSendOne = async (id: number) => {
    if (!confirm("Отправить этот пост в Telegram и ВКонтакте прямо сейчас?")) return;
    setSendingId(id);
    try {
      const res = await fetch(`${SAIT_BOT_DAILY_URL}?post_id=${id}`);
      const data = await res.json();
      const tgOk = !!data.tg;
      const vkOk = !!(data.vk && data.vk.ok);
      const lines: string[] = [];
      lines.push(tgOk ? "✅ Telegram: отправлено" : `❌ Telegram: ${data.tg_status || "ошибка"}`);
      lines.push(vkOk ? "✅ ВКонтакте: отправлено" : `❌ ВКонтакте: ${(data.vk && data.vk.error) || data.vk_status || "ошибка"}`);
      alert(lines.join("\n"));
      fetchPosts();
    } catch {
      alert("Ошибка соединения");
    }
    setSendingId(null);
  };

  const showBotsBlock = false as boolean;

  useEffect(() => {
    fetchPosts();
  }, []);

  const { unusedCount, cronStatus, scheduleMap, queueOrder } = useMemo(() => {
    let unused = 0;
    let lastSent: string | null = null;
    for (const p of posts) {
      if (!p.is_used) unused++;
      else if (p.scheduled_date && (!lastSent || p.scheduled_date > lastSent)) lastSent = p.scheduled_date;
    }
    const working = lastSent ? (Date.now() - new Date(lastSent).getTime()) < 36 * 60 * 60 * 1000 : false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);
    const sentToday = posts.some(p => p.scheduled_date === todayStr);
    const sorted = [...posts].sort((a, b) => {
      const ad = a.scheduled_date || "";
      const bd = b.scheduled_date || "";
      if (ad === bd) return a.id - b.id;
      if (!ad) return -1;
      if (!bd) return 1;
      return ad.localeCompare(bd);
    });

    const map: Record<number, { date: Date; index: number }> = {};
    const order: number[] = [];
    const start = new Date(today);
    if (sentToday) start.setDate(start.getDate() + 1);
    sorted.forEach((p, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      map[p.id] = { date: d, index: i };
      order.push(p.id);
    });

    return { unusedCount: unused, cronStatus: { working, lastSent }, scheduleMap: map, queueOrder: order };
  }, [posts]);

  const formatNextDate = (d: Date) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    const dateStr = d.toLocaleDateString("ru-RU", { day: "2-digit", month: "long" });
    if (diff === 0) return `Сегодня, 09:00 · ${dateStr}`;
    if (diff === 1) return `Завтра, 09:00 · ${dateStr}`;
    if (diff < 7) return `Через ${diff} дн., 09:00 · ${dateStr}`;
    return `${dateStr}, 09:00`;
  };

  return (
    <div className="space-y-8">
      <BotsListBlock token={token} show={showBotsBlock} />

      <BotPostsList
        posts={posts}
        loadingPosts={loadingPosts}
        sending={sending}
        unusedCount={unusedCount}
        scheduleMap={scheduleMap}
        queueOrder={queueOrder}
        formatNextDate={formatNextDate}
        onSendNow={handleSendNow}
        onAddNew={() => { setShowAdd(true); setEditingId(null); setForm({ photo_url: "", greeting: "", description: "" }); }}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onSendOne={handleSendOne}
        sendingId={sendingId}
        formSlot={showAdd && (
          <BotPostForm
            token={token}
            editingId={editingId}
            form={form}
            setForm={setForm}
            saving={saving}
            onSave={handleSave}
            onCancel={() => { setShowAdd(false); setEditingId(null); }}
          />
        )}
      />

      <BotCronStatus cronStatus={cronStatus} />
    </div>
  );
}

export default AdminBotTab;