import { useState } from "react";
import Icon from "@/components/ui/icon";
import { DISPATCH_ORDER_URL } from "./adminTypes";

interface OrderForm {
  from_city: string;
  to_city: string;
  from_address: string;
  to_address: string;
  stops: string[];
  date: string;
  time: string;
  price: string;
  tariff: string;
  commission: string;
  client_phone: string;
  people: string;
  luggage: string;
  booster: boolean;
  child_seat: boolean;
  animal: boolean;
  comment: string;
}

const TARIFFS = ["Срочный", "Эконом", "Комфорт", "Бизнес", "Минивэн"];
const COMMISSIONS = ["10%", "15%", "20%", "25%"];

const EMPTY: OrderForm = {
  from_city: "", to_city: "", from_address: "", to_address: "", stops: [],
  date: "", time: "", price: "", tariff: "Срочный", commission: "15%",
  client_phone: "", people: "1", luggage: "1",
  booster: false, child_seat: false, animal: false, comment: "",
};

const fieldCls =
  "w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-purple-400/50 transition-colors";
const labelCls = "text-xs font-medium text-muted-foreground mb-1.5 block";

export function AdminDispatchTab({ token }: { token: string }) {
  const [form, setForm] = useState<OrderForm>({ ...EMPTY });
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const set = <K extends keyof OrderForm>(k: K, v: OrderForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const addStop = () => set("stops", [...form.stops, ""]);
  const setStop = (i: number, v: string) =>
    set("stops", form.stops.map((s, idx) => (idx === i ? v : s)));
  const removeStop = (i: number) =>
    set("stops", form.stops.filter((_, idx) => idx !== i));

  async function submit() {
    if (!form.from_city && !form.to_city && !form.client_phone) {
      setMsg({ ok: false, text: "Заполни маршрут или номер клиента" });
      return;
    }
    setSending(true);
    setMsg(null);
    try {
      const r = await fetch(DISPATCH_ORDER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify({ ...form, stops: form.stops.filter(Boolean) }),
      });
      const j = await r.json();
      if (j.ok) {
        setMsg({ ok: true, text: "Заказ отправлен в Telegram!" });
        setForm({ ...EMPTY });
      } else {
        setMsg({ ok: false, text: j.error || "Не удалось отправить" });
      }
    } catch {
      setMsg({ ok: false, text: "Ошибка сети" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="glass rounded-2xl border border-white/5 p-5 md:p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl grad-btn flex items-center justify-center">
          <Icon name="Headset" size={20} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Создать заказ</h2>
          <p className="text-xs text-muted-foreground">Заявка уйдёт в Telegram</p>
        </div>
      </div>

      {/* Маршрут */}
      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
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
              className="px-3 py-2.5 rounded-xl border border-white/10 text-muted-foreground hover:text-red-400 hover:border-red-400/40 transition-colors">
              <Icon name="X" size={16} />
            </button>
          </div>
        ))}
        <button onClick={addStop}
          className="text-sm text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1.5">
          <Icon name="Plus" size={15} />Добавить промежуточный адрес
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Информация о заказе */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-purple-300 flex items-center gap-2">
            <Icon name="ClipboardList" size={16} />Информация о заказе
          </h3>
          <div className="grid grid-cols-2 gap-3">
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
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-purple-300 flex items-center gap-2">
            <Icon name="User" size={16} />Информация о клиенте
          </h3>
          <div className="grid grid-cols-2 gap-3">
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
          <div className="flex flex-wrap gap-4 pt-1">
            {([
              ["booster", "Бустер"],
              ["child_seat", "Детское кресло"],
              ["animal", "Животное"],
            ] as const).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input type="checkbox" checked={form[k]}
                  onChange={(e) => set(k, e.target.checked)}
                  className="w-4 h-4 rounded accent-purple-500" />
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
        <div className={`text-sm rounded-xl px-4 py-3 ${msg.ok ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
          {msg.text}
        </div>
      )}

      <button onClick={submit} disabled={sending}
        className="grad-btn w-full md:w-auto px-8 py-3 rounded-xl font-semibold shadow-lg disabled:opacity-60 flex items-center justify-center gap-2">
        <Icon name={sending ? "Loader" : "Send"} size={17} className={sending ? "animate-spin" : ""} />
        {sending ? "Отправка..." : "Отправить заказ"}
      </button>
    </div>
  );
}

export default AdminDispatchTab;
