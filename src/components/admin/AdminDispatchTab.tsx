import { useState } from "react";
import Icon from "@/components/ui/icon";
import { DISPATCH_ORDER_URL } from "./adminTypes";
import { OrderForm, EMPTY_ORDER, TARIFFS, COMMISSIONS } from "./dispatch/dispatchTypes";

const fieldCls =
  "w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-purple-400/50 transition-colors";
const labelCls = "text-[11px] font-medium text-muted-foreground mb-0.5 block";

interface DispatchTabProps {
  token: string;
  initialOrder?: OrderForm | null;
  editId?: number | null;
  onSent?: () => void;
}

export function AdminDispatchTab({ token, initialOrder, editId, onSent }: DispatchTabProps) {
  const [form, setForm] = useState<OrderForm>(initialOrder ? { ...initialOrder } : { ...EMPTY_ORDER });
  const [sending, setSending] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const set = <K extends keyof OrderForm>(k: K, v: OrderForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const addStop = () => set("stops", [...form.stops, ""]);
  const setStop = (i: number, v: string) =>
    set("stops", form.stops.map((s, idx) => (idx === i ? v : s)));
  const removeStop = (i: number) =>
    set("stops", form.stops.filter((_, idx) => idx !== i));

  function validate(): boolean {
    if (!form.from_city && !form.to_city && !form.client_phone) {
      setMsg({ ok: false, text: "Заполни маршрут или номер клиента" });
      return false;
    }
    return true;
  }

  function payload(action: string) {
    const body: Record<string, unknown> = { ...form, stops: form.stops.filter(Boolean) };
    if (editId) body.id = editId;
    return { action, body };
  }

  async function submit() {
    if (!validate()) return;
    setSending(true);
    setMsg(null);
    try {
      const { body } = payload("send");
      const r = await fetch(`${DISPATCH_ORDER_URL}?action=send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j.ok) {
        setMsg({ ok: true, text: "Заказ отправлен на продажу в Telegram!" });
        setForm({ ...EMPTY_ORDER });
        onSent?.();
      } else {
        setMsg({ ok: false, text: j.error || "Не удалось отправить" });
      }
    } catch {
      setMsg({ ok: false, text: "Ошибка сети" });
    } finally {
      setSending(false);
    }
  }

  async function toArchive() {
    if (!validate()) return;
    setArchiving(true);
    setMsg(null);
    try {
      const { body } = payload("archive_save");
      const r = await fetch(`${DISPATCH_ORDER_URL}?action=archive_save`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j.ok) {
        setMsg({ ok: true, text: "Заказ сохранён в архив" });
        setForm({ ...EMPTY_ORDER });
        onSent?.();
      } else {
        setMsg({ ok: false, text: j.error || "Не удалось сохранить" });
      }
    } catch {
      setMsg({ ok: false, text: "Ошибка сети" });
    } finally {
      setArchiving(false);
    }
  }

  return (
    <div className="glass rounded-2xl border border-white/5 p-4 space-y-4 max-w-4xl">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg grad-btn flex items-center justify-center">
          <Icon name="Headset" size={16} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white leading-tight">
            {editId ? "Редактировать заказ" : "Создать заказ"}
          </h2>
          <p className="text-[11px] text-muted-foreground">На продажу — в Telegram, в архив — предзаказ</p>
        </div>
      </div>

      {/* Маршрут */}
      <div className="space-y-2.5">
        <div className="grid md:grid-cols-2 gap-x-4 gap-y-2.5">
          <div>
            <label className={labelCls}>Откуда (город)</label>
            <input className={fieldCls} placeholder="Откуда" value={form.from_city}
              onChange={(e) => set("from_city", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Куда (город)</label>
            <input className={fieldCls} placeholder="Куда" value={form.to_city}
              onChange={(e) => set("to_city", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Откуда забрать *</label>
            <input className={fieldCls} placeholder="Адрес подачи" value={form.from_address}
              onChange={(e) => set("from_address", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Куда довести *</label>
            <input className={fieldCls} placeholder="Адрес назначения" value={form.to_address}
              onChange={(e) => set("to_address", e.target.value)} />
          </div>
        </div>

        {form.stops.map((s, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1">
              <label className={labelCls}>Промежуточный адрес {i + 1}</label>
              <input className={fieldCls} placeholder="Промежуточный адрес" value={s}
                onChange={(e) => setStop(i, e.target.value)} />
            </div>
            <button onClick={() => removeStop(i)}
              className="px-2.5 py-1.5 rounded-lg border border-white/10 text-muted-foreground hover:text-red-400 hover:border-red-400/40 transition-colors">
              <Icon name="X" size={15} />
            </button>
          </div>
        ))}
        <button onClick={addStop}
          className="text-[13px] text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1.5">
          <Icon name="Plus" size={14} />Добавить промежуточный адрес
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-x-6 gap-y-3">
        {/* Информация о заказе */}
        <div className="space-y-2.5">
          <h3 className="text-[13px] font-semibold text-purple-300 flex items-center gap-1.5">
            <Icon name="ClipboardList" size={15} />Информация о заказе
          </h3>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className={labelCls}>Дата поездки *</label>
              <input type="date" className={fieldCls} value={form.date}
                onChange={(e) => set("date", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Время начала</label>
              <input type="time" className={fieldCls} value={form.time}
                onChange={(e) => set("time", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Стоимость *</label>
              <input type="number" inputMode="numeric" className={fieldCls} placeholder="₽" value={form.price}
                onChange={(e) => set("price", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Тариф *</label>
              <select className={fieldCls} value={form.tariff}
                onChange={(e) => set("tariff", e.target.value)}>
                {TARIFFS.map((t) => <option key={t} value={t} className="bg-zinc-900">{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Процент комиссии *</label>
              <select className={fieldCls} value={form.commission}
                onChange={(e) => set("commission", e.target.value)}>
                {COMMISSIONS.map((c) => <option key={c} value={c} className="bg-zinc-900">{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Информация о клиенте */}
        <div className="space-y-2.5">
          <h3 className="text-[13px] font-semibold text-purple-300 flex items-center gap-1.5">
            <Icon name="User" size={15} />Информация о клиенте
          </h3>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="col-span-2">
              <label className={labelCls}>Номер клиента *</label>
              <input className={fieldCls} placeholder="+7 ..." value={form.client_phone}
                onChange={(e) => set("client_phone", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Количество человек *</label>
              <input type="number" inputMode="numeric" min={1} className={fieldCls} value={form.people}
                onChange={(e) => set("people", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Количество багажа *</label>
              <input type="number" inputMode="numeric" min={0} className={fieldCls} value={form.luggage}
                onChange={(e) => set("luggage", e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-0.5">
            {([
              ["booster", "Бустер"],
              ["child_seat", "Детское кресло"],
              ["animal", "Животное"],
            ] as const).map(([k, label]) => (
              <label key={k} className="flex items-center gap-1.5 text-[13px] text-white cursor-pointer">
                <input type="checkbox" checked={form[k]}
                  onChange={(e) => set(k, e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-purple-500" />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className={labelCls}>Комментарий</label>
        <textarea className={`${fieldCls} resize-none`} rows={2} placeholder="Дополнительно..."
          value={form.comment} onChange={(e) => set("comment", e.target.value)} />
      </div>

      {msg && (
        <div className={`text-[13px] rounded-lg px-3 py-2 ${msg.ok ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
          {msg.text}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2.5">
        <button onClick={submit} disabled={sending || archiving}
          className="grad-btn px-6 py-2.5 rounded-lg font-semibold shadow-lg disabled:opacity-60 flex items-center justify-center gap-2">
          <Icon name={sending ? "Loader" : "Send"} size={16} className={sending ? "animate-spin" : ""} />
          {sending ? "Отправка..." : "Отправить на продажу"}
        </button>
        <button onClick={toArchive} disabled={sending || archiving}
          className="px-6 py-2.5 rounded-lg font-semibold border border-white/15 text-white hover:bg-white/5 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors">
          <Icon name={archiving ? "Loader" : "Archive"} size={16} className={archiving ? "animate-spin" : ""} />
          {archiving ? "Сохранение..." : "Отправить в архив"}
        </button>
      </div>
    </div>
  );
}

export default AdminDispatchTab;