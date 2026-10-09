import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import { LISTS, LISTS_API, TG_LOOKUP_API, inputCls, detectQuery } from "./listTypes";

interface Props {
  token: string;
  onSaved: () => void;
  onCancel: () => void;
  prefill?: { value: string; nonce: number } | null;
}


const empty = { name: "", username: "", phone: "", tg_id: "", photo_url: "", note: "", reason: "", removed_at: "" };

const lineCls =
  "w-full bg-transparent border-0 border-b border-white/10 px-0 py-1 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-sky-400/60";

export function NewPersonCardForm({ token, onSaved, onCancel, prefill }: Props) {
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (!prefill) return;
    const det = detectQuery(prefill.value);
    if (!det) return;
    setForm({ ...empty, [det.field]: det.value });
    setScanned(false);
  }, [prefill]);
  const [listKey, setListKey] = useState("pending");
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [saving, setSaving] = useState(false);

  const pending = listKey === "pending";
  const def = LISTS.find((d) => `${d.role}-${d.list_type}` === listKey);
  const black = def?.list_type === "black";
  const target = def ? { role: def.role, list_type: def.list_type } : { role: "", list_type: "pending" };
  const targetTitle = def ? def.title : "На модерации";
  const phoneDigits = form.phone.replace(/\D/g, "");
  const uname = form.username.trim().replace(/^https?:\/\/t\.me\//i, "").replace(/^@/, "").split(/[/?]/)[0];
  const canScan = uname.length >= 4 || phoneDigits.length >= 10;

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [k]: e.target.value });
    if (k === "username" || k === "phone") setScanned(false);
  };

  const scan = async () => {
    if (!canScan) return;
    setScanning(true);
    try {
      const q = uname.length >= 4 ? `username=${encodeURIComponent(uname)}` : `phone=${phoneDigits}`;
      const res = await fetch(`${TG_LOOKUP_API}?${q}`, { headers: { "X-Admin-Token": token } });
      const d = await res.json().catch(() => ({}));
      if (!d.ok) {
        toast.error(d.error || (res.status >= 500 ? "Telegram не ответил вовремя" : "Не удалось получить данные"));
        return;
      }
      const next = {
        ...form,
        name: d.name || form.name,
        username: d.username || form.username,
        tg_id: String(d.tg_id),
        phone: form.phone || d.phone || "",
        photo_url: d.photo_url || form.photo_url,
        note: form.note || d.bio || "",
      };
      setForm(next);
      setScanned(true);
      if (pending) {
        await save(next);
      } else {
        toast.success("Данные подтянуты из Telegram");
      }
    } catch {
      toast.error("Не удалось связаться с Telegram");
    } finally {
      setScanning(false);
    }
  };

  const save = async (data = form) => {
    if (!data.name.trim() && !uname && !phoneDigits && !data.tg_id) {
      toast.error("Укажите @username или номер телефона");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(LISTS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify({ ...data, ...target }),
      });
      const d = await res.json();
      if (d.ok) {
        toast.success(`Добавлено: ${targetTitle}`, pending ? { description: "Присвойте статус в строке «На модерации»" } : undefined);
        setForm(empty);
        setScanned(false);
        onSaved();
      } else toast.error("Не удалось сохранить");
    } catch {
      toast.error("Не удалось сохранить");
    }
    setSaving(false);
  };

  const initials = (form.name || uname || "").slice(0, 2).toUpperCase();

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-white">Новая запись</div>
        <button onClick={onCancel} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5">
          <Icon name="X" size={16} />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setListKey("pending")}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5 ${
            pending ? "border-amber-500/50 bg-amber-500/20 text-amber-200" : "border-white/10 text-white/50 hover:text-white"
          }`}
        >
          <Icon name="Clock" size={12} />На модерацию
        </button>
        {LISTS.map((d) => {
          const k = `${d.role}-${d.list_type}`;
          const active = k === listKey;
          const isBlack = d.list_type === "black";
          return (
            <button
              key={k}
              onClick={() => setListKey(k)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                active
                  ? isBlack ? "border-red-500/50 bg-red-500/20 text-red-200" : "border-emerald-500/50 bg-emerald-500/20 text-emerald-200"
                  : "border-white/10 text-white/50 hover:text-white"
              }`}
            >
              {d.title}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-5 items-start">
        <div className="relative pt-1.5 pr-1.5 w-full sm:w-60 shrink-0">
          <div
            className={`absolute top-0 right-0 left-1.5 bottom-1.5 rounded-2xl border ${
              pending ? "border-amber-500/25 bg-amber-500/[0.06]" : black ? "border-red-500/25 bg-red-500/[0.06]" : "border-emerald-500/25 bg-emerald-500/[0.06]"
            }`}
          />
          <div className={`relative rounded-2xl border bg-[#14141c] overflow-hidden ${pending ? "border-amber-500/30" : black ? "border-red-500/30" : "border-emerald-500/30"}`}>
            <div className="relative aspect-square bg-white/5">
              {form.photo_url ? (
                <img src={form.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  {initials ? (
                    <span className="text-3xl font-semibold text-white/30">{initials}</span>
                  ) : (
                    <Icon name="User" size={40} className="text-white/20" />
                  )}
                </div>
              )}
              {scanning && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 text-xs text-sky-200">
                  <Icon name="Loader2" size={22} className="animate-spin" />Сканирую Telegram…
                </div>
              )}
              {canScan && !scanning && (
                <button
                  onClick={scan}
                  className="absolute top-2 right-2 rounded-full bg-sky-500 hover:bg-sky-400 text-white text-xs font-medium pl-2.5 pr-3 py-1.5 flex items-center gap-1.5 shadow-lg"
                >
                  <Icon name={scanned ? "RefreshCw" : "ScanSearch"} fallback="Search" size={13} />
                  {scanned ? "Ещё раз" : "Сканировать"}
                </button>
              )}
              {scanned && (
                <span className="absolute bottom-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500 text-black font-medium flex items-center gap-1">
                  <Icon name="Check" size={11} />из Telegram
                </span>
              )}
            </div>

            <div className="p-3 space-y-2">
              <input value={form.name} onChange={set("name")} placeholder="Имя"
                className={`${lineCls} text-sm font-semibold`} />
              <div className="flex items-center gap-1.5">
                <Icon name="Hash" size={12} className="text-white/40 shrink-0" />
                <input value={form.tg_id} onChange={(e) => setForm({ ...form, tg_id: e.target.value.replace(/\D/g, "") })}
                  inputMode="numeric" placeholder="Telegram ID" className={`${lineCls} font-mono`} />
              </div>
              <div className="flex items-center gap-1.5">
                <Icon name="Phone" size={12} className="text-white/40 shrink-0" />
                <input value={form.phone} onChange={set("phone")} inputMode="tel" placeholder="Номер телефона" className={lineCls} />
              </div>
              <div className="flex items-center gap-1.5">
                <Icon name="AtSign" size={12} className="text-white/40 shrink-0" />
                <input value={form.username} onChange={set("username")} placeholder="username" className={`${lineCls} text-sky-300`} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 w-full space-y-3">
          {!canScan && (
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.06] px-3 py-2.5 text-xs text-sky-200 flex gap-2">
              <Icon name="Info" size={14} className="shrink-0 mt-0.5" />
              Впишите в карточку @username или номер телефона — появится кнопка «Сканировать», и данные подтянутся из Telegram.
              {pending && " После сканирования карточка сама уйдёт на модерацию."}
            </div>
          )}
          {black && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.05] p-3 space-y-2">
              <div className="text-xs font-medium text-red-300">Чёрный список</div>
              <textarea value={form.reason} onChange={set("reason")} rows={3}
                placeholder="За что: например, кинул на предоплату" className={`${inputCls} resize-y`} />
              <label className="block text-xs text-white/50">
                Когда удалён
                <input type="date" value={form.removed_at} onChange={set("removed_at")} className={`${inputCls} mt-1 [color-scheme:dark]`} />
              </label>
            </div>
          )}
          <textarea value={form.note} onChange={set("note")} rows={black ? 2 : 4}
            placeholder="Комментарий" className={`${inputCls} resize-y`} />
          <div className="flex gap-2">
            <button onClick={() => save()} disabled={saving || scanning}
              className="grad-btn text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-60 flex items-center gap-2">
              <Icon name={saving ? "Loader2" : "Check"} size={15} className={saving ? "animate-spin" : ""} />
              Сохранить
            </button>
            <button onClick={onCancel} className="rounded-xl px-4 py-2 text-sm border border-white/10 text-white/70 hover:bg-white/5">
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NewPersonCardForm;
