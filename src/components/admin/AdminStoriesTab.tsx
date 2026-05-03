import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import { ADMIN_BOT_STORIES_URL, UPLOAD_VIDEO_URL } from "./adminTypes";
import type { BotStory } from "./adminTypes";
import { TgUserLogin } from "./TgUserLogin";

const CHUNK_SIZE = 512 * 1024; // 512 KB

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}

async function uploadVideoFile(file: File, token: string, onProgress: (pct: number) => void): Promise<string> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const initRes = await fetch(`${UPLOAD_VIDEO_URL}?action=init`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Token": token },
    body: JSON.stringify({ filename: file.name, total_chunks: totalChunks, mode: "raw" }),
  });
  const initData = await initRes.json();
  if (!initData.ok) throw new Error(initData.error || "init failed");
  const uploadId = initData.upload_id;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const blob = file.slice(start, start + CHUNK_SIZE);
    const b64 = await blobToBase64(blob);
    const r = await fetch(`${UPLOAD_VIDEO_URL}?action=chunk&id=${uploadId}&n=${i}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Token": token },
      body: JSON.stringify({ data: b64 }),
    });
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || `chunk ${i} failed`);
    onProgress(Math.round(((i + 1) / totalChunks) * 90));
  }

  onProgress(95);
  const completeRes = await fetch(`${UPLOAD_VIDEO_URL}?action=complete&id=${uploadId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Token": token },
    body: "{}",
  });
  const completeData = await completeRes.json();
  if (!completeData.ok) throw new Error(completeData.error || "complete failed");
  onProgress(100);
  return completeData.url;
}

interface Props {
  token: string;
}

export function AdminStoriesTab({ token }: Props) {
  const [items, setItems] = useState<BotStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const headers = { "Content-Type": "application/json", "X-Admin-Token": token };

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(ADMIN_BOT_STORIES_URL, { headers: { "X-Admin-Token": token } });
      const d = await r.json();
      setItems(d.items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const reset = () => {
    setVideoUrl(""); setCaption(""); setEditId(null); setError("");
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setUploadPct(0); setError("");
    try {
      const url = await uploadVideoFile(file, token, setUploadPct);
      setVideoUrl(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ошибка";
      setError(`Не удалось загрузить: ${msg}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async () => {
    if (!videoUrl.trim()) { setError("Укажи ссылку на видео"); return; }
    setSaving(true); setError("");
    try {
      const body = JSON.stringify({ id: editId, video_url: videoUrl, caption });
      const r = await fetch(ADMIN_BOT_STORIES_URL, {
        method: editId ? "PUT" : "POST", headers, body,
      });
      const d = await r.json();
      if (!d.ok) { setError(d.error || "Ошибка"); return; }
      reset();
      await load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Удалить сторис?")) return;
    await fetch(`${ADMIN_BOT_STORIES_URL}?id=${id}`, { method: "DELETE", headers: { "X-Admin-Token": token } });
    await load();
  };

  const sendNow = async (id: number) => {
    setSendingId(id);
    try {
      const r = await fetch(`${ADMIN_BOT_STORIES_URL}?action=send_now`, {
        method: "POST", headers, body: JSON.stringify({ id }),
      });
      const d = await r.json();
      if (!d.ok) alert(`Не удалось опубликовать: ${d.status || d.error || "ошибка"}`);
      await load();
    } finally {
      setSendingId(null);
    }
  };

  const edit = (s: BotStory) => {
    setEditId(s.id); setVideoUrl(s.video_url); setCaption(s.caption || "");
  };

  return (
    <div className="space-y-6">
      <TgUserLogin token={token} />

      <div className="rounded-2xl border border-white/8 p-6" style={{ background: "rgba(255,255,255,0.02)" }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center">
            <Icon name="Film" size={20} className="text-pink-400" />
          </div>
          <div>
            <h3 className="text-white font-medium text-lg">{editId ? "Редактирование сторис" : "Новый сторис"}</h3>
            <p className="text-white/40 text-xs">Видео 9:16 · автопубликация в @ug_transfer_pro раз в 48 часов</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">Видео для сторис</label>
            <input
              ref={fileRef} type="file" accept="video/*" onChange={onPickFile} className="hidden"
            />
            <div className="flex gap-2">
              <button
                type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex-shrink-0 px-4 py-3 rounded-xl bg-pink-500/10 border border-pink-500/30 text-pink-300 text-sm font-medium hover:bg-pink-500/20 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Icon name={uploading ? "Loader2" : "Upload"} size={16} className={uploading ? "animate-spin" : ""} />
                {uploading ? `Загрузка ${uploadPct}%` : "Загрузить файл"}
              </button>
              <input
                type="url" value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
                placeholder="или вставь ссылку на mp4..."
                className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-pink-500/50"
              />
            </div>
            {uploading && (
              <div className="mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all" style={{ width: `${uploadPct}%` }} />
              </div>
            )}
            {videoUrl && !uploading && (
              <div className="mt-2 flex items-center gap-2 text-xs text-emerald-300">
                <Icon name="CheckCircle" size={13} />
                <span className="truncate">Видео готово: {videoUrl.split("/").pop()}</span>
              </div>
            )}
            <p className="text-[11px] text-white/30 mt-1.5">Формат — mp4, вертикальное 9:16, до 60 секунд, не более 150 МБ.</p>
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">Подпись (необязательно)</label>
            <textarea
              value={caption} onChange={e => setCaption(e.target.value)} rows={2}
              placeholder="Текст к сторис..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-pink-500/50 resize-none"
            />
          </div>
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-red-400 text-xs flex items-center gap-2">
              <Icon name="AlertCircle" size={14} />{error}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={save} disabled={saving}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? "Сохранение..." : editId ? "Сохранить" : "Добавить в очередь"}
            </button>
            {editId && (
              <button onClick={reset} className="px-4 py-2.5 rounded-xl border border-white/10 text-white/60 text-sm hover:bg-white/5">
                Отмена
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/8 p-6" style={{ background: "rgba(255,255,255,0.02)" }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
            <Icon name="ListVideo" size={20} className="text-orange-400" />
          </div>
          <div>
            <h3 className="text-white font-medium text-lg">Очередь сторис</h3>
            <p className="text-white/40 text-xs">
              <Icon name="RefreshCw" size={11} className="inline mr-1" />
              {items.length} {items.length === 1 ? "видео" : "видео"} · публикация автоматом каждые 48 часов
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-pink-500/30 border-t-pink-500 rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-white/30 text-center py-8">Пока нет видео. Добавь первое выше.</p>
        ) : (
          <div className="space-y-3">
            {items.map(s => (
              <div key={s.id} className="flex gap-4 p-4 rounded-xl border border-white/8 bg-white/3">
                <video src={s.video_url} className="w-20 h-32 object-cover rounded-lg border border-white/10 flex-shrink-0 bg-black" muted />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-white text-sm break-all">{s.caption || <span className="text-white/30">Без подписи</span>}</p>
                      <p className="text-white/40 text-xs mt-1 truncate">{s.video_url}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => sendNow(s.id)} disabled={sendingId === s.id}
                        title="Опубликовать сейчас"
                        className="w-8 h-8 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 flex items-center justify-center disabled:opacity-40"
                      >
                        {sendingId === s.id
                          ? <div className="w-3 h-3 border border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                          : <Icon name="Send" size={14} className="text-emerald-400" />}
                      </button>
                      <button onClick={() => edit(s)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center">
                        <Icon name="Pencil" size={14} className="text-white/50" />
                      </button>
                      <button onClick={() => remove(s.id)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center">
                        <Icon name="Trash2" size={14} className="text-white/50 hover:text-red-400" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {s.is_used && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40">Уже отправлен</span>
                    )}
                    {!s.is_used && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">В очереди</span>
                    )}
                    {s.last_status && (
                      <span
                        title={s.last_status}
                        className={`text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${s.last_status === "ok" ? "bg-sky-500/10 border border-sky-500/20 text-sky-300" : "bg-red-500/10 border border-red-500/20 text-red-300"}`}
                      >
                        <Icon name={s.last_status === "ok" ? "CheckCircle" : "AlertCircle"} size={10} />
                        {s.last_status === "ok" ? "опубликован" : "ошибка"}
                      </span>
                    )}
                    <span className="text-white/20 text-[10px] ml-auto">#{s.id}</span>
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

export default AdminStoriesTab;