import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import { fmtDate, inputCls, UPLOAD_API } from "./listTypes";
import { KB_BOT_URL } from "../adminTypes";

const API = `${KB_BOT_URL}?action=broadcast`;

interface Item {
  id: number; text: string; photo_url: string; button_text: string; button_url: string; audience: string;
  total: number; sent: number; failed: number; status: string; created_at: string; finished_at: string | null;
}

const AUDIENCES = [
  { key: "all", label: "Все", hint: "Все, кто запускал бота" },
  { key: "active", label: "С подпиской", hint: "Подписка или тест сейчас активны" },
  { key: "expired", label: "Без подписки", hint: "Тест или подписка закончились" },
  { key: "driver", label: "Водители", hint: "Выбрали роль «водитель»" },
  { key: "dispatcher", label: "Диспетчеры", hint: "Выбрали роль «диспетчер»" },
];

const STATUS: Record<string, { label: string; cls: string }> = {
  running: { label: "Идёт", cls: "bg-cyan-500/20 text-cyan-300" },
  done: { label: "Завершена", cls: "bg-emerald-500/20 text-emerald-300" },
  cancelled: { label: "Остановлена", cls: "bg-white/10 text-white/60" },
};

export function BroadcastPage({ token, onBack }: { token: string; onBack: () => void }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [items, setItems] = useState<Item[]>([]);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState("");
  const [btnText, setBtnText] = useState("");
  const [btnUrl, setBtnUrl] = useState("");
  const [audience, setAudience] = useState("all");
  const [testId, setTestId] = useState(() => localStorage.getItem("bc_test_id") || "");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const running = items.find((i) => i.status === "running");
  const loopRef = useRef(false);
  const headers = { "Content-Type": "application/json", "X-Admin-Token": token };

  const load = async () => {
    const d = await fetch(API, { headers: { "X-Admin-Token": token } }).then((r) => r.json()).catch(() => null);
    if (d?.ok) {
      setCounts(d.counts || {});
      setItems(d.items || []);
    }
    return d;
  };

  const loop = async () => {
    if (loopRef.current) return;
    loopRef.current = true;
    let errors = 0;
    while (loopRef.current) {
      const d = await fetch(`${API}&op=step`, { method: "POST", headers, body: "{}" }).then((r) => r.json()).catch(() => null);
      if (!d?.ok) {
        errors += 1;
        if (errors >= 5) { toast.error("Рассылка прервалась — нажмите «Продолжить»"); break; }
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      errors = 0;
      if (d.idle) break;
      setItems((prev) => prev.map((i) => (i.id === d.id ? { ...i, sent: d.sent, failed: d.failed, status: d.status } : i)));
      if (d.status !== "running") {
        toast.success(`Рассылка завершена: доставлено ${d.sent}`);
        break;
      }
    }
    loopRef.current = false;
    load();
  };

  useEffect(() => {
    load();
    return () => { loopRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const upload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { toast.error("Картинка больше 5 МБ"); return; }
    setUploading(true);
    try {
      const b64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const d = await fetch(UPLOAD_API, { method: "POST", headers, body: JSON.stringify({ file: b64, content_type: file.type }) }).then((r) => r.json());
      if (d.ok) setPhoto(d.url);
      else toast.error("Не удалось загрузить картинку");
    } catch {
      toast.error("Не удалось загрузить картинку");
    }
    setUploading(false);
  };

  const payload = { text, photo_url: photo, button_text: btnText, button_url: btnUrl, audience };

  const sendTest = async () => {
    if (!testId.trim()) { toast.error("Укажите свой Telegram ID"); return; }
    localStorage.setItem("bc_test_id", testId.trim());
    setBusy(true);
    const d = await fetch(`${API}&op=test`, { method: "POST", headers, body: JSON.stringify({ ...payload, chat_id: Number(testId.trim()) }) })
      .then((r) => r.json()).catch(() => null);
    setBusy(false);
    if (d?.ok) toast.success("Тестовое сообщение отправлено вам в бот");
    else toast.error(d?.error || "Не удалось отправить. Вы запускали бота?");
  };

  const start = async () => {
    const n = counts[audience] || 0;
    if (!confirm(`Отправить рассылку ${n} получателям? Отменить уже отправленные сообщения будет нельзя.`)) return;
    setBusy(true);
    const d = await fetch(`${API}&op=create`, { method: "POST", headers, body: JSON.stringify(payload) }).then((r) => r.json()).catch(() => null);
    setBusy(false);
    if (!d?.ok) { toast.error(d?.error || "Не удалось запустить рассылку"); return; }
    toast.success("Рассылка запущена");
    setText(""); setPhoto(""); setBtnText(""); setBtnUrl("");
    await load();
    loop();
  };

  const stop = async (id: number) => {
    loopRef.current = false;
    await fetch(`${API}&op=cancel&id=${id}`, { method: "POST", headers, body: "{}" }).catch(() => null);
    load();
  };

  const limit = photo ? 1000 : 4000;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBack}
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm border border-white/10 text-white/70 hover:text-white hover:bg-white/5">
          <Icon name="ArrowLeft" size={14} />Назад
        </button>
        <Icon name="Megaphone" size={18} className="text-pink-300" />
        <span className="text-base font-medium text-white">Рассылка через бота</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="text-xs text-white/50">Подписчиков бота</div>
          <div className="text-2xl font-semibold text-white">{counts.all ?? "—"}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="text-xs text-white/50">С подпиской</div>
          <div className="text-2xl font-semibold text-white">{counts.active ?? "—"}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="text-xs text-white/50">Заблокировали бота</div>
          <div className="text-2xl font-semibold text-white/60">{counts.blocked ?? "—"}</div>
        </div>
      </div>

      {running && (
        <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/[0.06] p-4 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <Icon name="Send" size={16} className="text-cyan-300" />
            <span className="text-sm text-white flex-1">Идёт рассылка: {running.sent + running.failed} из {running.total} · доставлено {running.sent}</span>
            {!loopRef.current && (
              <button onClick={loop} className="grad-btn text-white rounded-xl px-3 py-1.5 text-sm flex items-center gap-1.5">
                <Icon name="Play" size={13} />Продолжить
              </button>
            )}
            <button onClick={() => stop(running.id)} className="rounded-xl px-3 py-1.5 text-sm border border-white/15 text-white/80 hover:bg-white/5 flex items-center gap-1.5">
              <Icon name="Square" size={13} />Стоп
            </button>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-cyan-400 transition-all" style={{ width: `${((running.sent + running.failed) / Math.max(1, running.total)) * 100}%` }} />
          </div>
          <div className="text-[11px] text-white/40">Не закрывайте эту страницу, пока идёт отправка</div>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
        <div className="text-sm font-medium text-white">Новая рассылка</div>

        <div className="space-y-1.5">
          <div className="text-xs text-white/50">Кому отправить</div>
          <div className="flex flex-wrap gap-2">
            {AUDIENCES.map((a) => (
              <button key={a.key} onClick={() => setAudience(a.key)} title={a.hint}
                className={`rounded-xl px-3 py-1.5 text-sm border ${audience === a.key ? "border-pink-400/60 bg-pink-500/15 text-white" : "border-white/10 text-white/60 hover:text-white"}`}>
                {a.label} <span className="text-white/40">· {counts[a.key] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-white/50">
            <span>Текст сообщения</span>
            <span className={text.length > limit ? "text-red-400" : ""}>{text.length}/{limit}</span>
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6}
            placeholder="Например: 🔥 Скидка 30% на подписку до конца недели!"
            className={`${inputCls} resize-y`} />
          <div className="text-[11px] text-white/30">Можно жирный &lt;b&gt;текст&lt;/b&gt; и курсив &lt;i&gt;текст&lt;/i&gt;</div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {photo ? (
            <div className="relative">
              <img src={photo} alt="" className="h-20 rounded-xl object-cover" />
              <button onClick={() => setPhoto("")} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-black/80 text-white flex items-center justify-center">
                <Icon name="X" size={12} />
              </button>
            </div>
          ) : (
            <label className="cursor-pointer rounded-xl px-3 py-2 text-sm border border-dashed border-white/20 text-white/70 hover:text-white flex items-center gap-2">
              <Icon name={uploading ? "Loader2" : "ImagePlus"} fallback="Image" size={15} className={uploading ? "animate-spin" : ""} />
              {uploading ? "Загружаю…" : "Добавить картинку"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-2">
          <input value={btnText} onChange={(e) => setBtnText(e.target.value)} placeholder="Текст кнопки (необязательно)" className={inputCls} />
          <input value={btnUrl} onChange={(e) => setBtnUrl(e.target.value)} placeholder="Ссылка кнопки: https://…" className={inputCls} />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-white/10">
          <input value={testId} onChange={(e) => setTestId(e.target.value.replace(/\D/g, ""))}
            placeholder="Ваш Telegram ID для теста" className={`${inputCls} sm:max-w-[220px]`} />
          <button onClick={sendTest} disabled={busy || (!text && !photo)}
            className="rounded-xl px-4 py-2 text-sm border border-white/10 text-white/80 hover:bg-white/5 flex items-center justify-center gap-2 disabled:opacity-50">
            <Icon name="FlaskConical" fallback="Send" size={15} />Тест себе
          </button>
          <button onClick={start} disabled={busy || !!running || (!text && !photo) || text.length > limit}
            className="grad-btn text-white rounded-xl px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 sm:ml-auto">
            <Icon name="Send" size={15} />Отправить {counts[audience] ?? 0} получателям
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
        <div className="text-sm font-medium text-white">История рассылок</div>
        {items.length === 0 ? (
          <div className="text-sm text-white/40 py-4 text-center">Рассылок ещё не было</div>
        ) : (
          items.map((i) => {
            const s = STATUS[i.status] || STATUS.done;
            return (
              <div key={i.id} className="flex gap-3 py-2 border-b border-white/5 last:border-0">
                {i.photo_url && <img src={i.photo_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white/80 line-clamp-2 whitespace-pre-line">{i.text || "Только картинка"}</div>
                  <div className="text-[11px] text-white/40 mt-1">
                    {fmtDate(i.created_at, true)} · {AUDIENCES.find((a) => a.key === i.audience)?.label || i.audience} · доставлено {i.sent} из {i.total}
                    {i.failed ? ` · не дошло ${i.failed}` : ""}
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 h-fit rounded-full shrink-0 ${s.cls}`}>{s.label}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default BroadcastPage;
