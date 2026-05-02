import { useState } from "react";
import Icon from "@/components/ui/icon";

type Tariff = {
  id: string;
  label: string;
  icon: string;
  hint?: string;
};

const TARIFFS: Tariff[] = [
  { id: "express", label: "Срочный", icon: "Zap" },
  { id: "standard", label: "Стандарт", icon: "Car" },
  { id: "comfort", label: "Комфорт", icon: "CarFront" },
  { id: "minivan", label: "Минивэн", icon: "Bus" },
  { id: "business", label: "Бизнес", icon: "Crown" },
];

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function OrderForm() {
  const today = new Date();
  const defaultDate = `${pad(today.getDate())}-${pad(today.getMonth() + 1)}-${today.getFullYear()}`;
  const defaultTime = `${pad(today.getHours())}:${pad(today.getMinutes())}`;

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime);
  const [tariff, setTariff] = useState<string>("standard");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!from.trim() || !to.trim() || !name.trim() || !phone.trim()) {
      setError("Заполни маршрут, имя и телефон");
      return;
    }
    setSending(true);
    try {
      const text = [
        `🚖 Новая заявка на трансфер`,
        ``,
        `📍 Откуда: ${from}`,
        `📍 Куда: ${to}`,
        `👤 ${name}`,
        `📱 ${phone}`,
        `📅 ${date} в ${time}`,
        `🚗 Тариф: ${TARIFFS.find(t => t.id === tariff)?.label}`,
      ].join("\n");

      const tgUrl = `https://t.me/ug_transfer_online?text=${encodeURIComponent(text)}`;
      window.open(tgUrl, "_blank");
      setSent(true);
      setTimeout(() => setSent(false), 4000);
    } catch (e) {
      setError("Не удалось отправить. Позвони +7 (984) 334-87-24");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-black/90 backdrop-blur-xl rounded-3xl border border-white/10 p-4 md:p-5 w-full max-w-[340px] shadow-2xl">
      <div className="space-y-2.5">
        {/* Откуда */}
        <input
          value={from}
          onChange={e => setFrom(e.target.value)}
          placeholder="Откуда?"
          className="w-full bg-white/5 border border-white/10 focus:border-yellow-400/60 rounded-2xl px-4 py-3 text-white text-sm outline-none placeholder-white/40 transition-colors"
        />
        {/* Куда */}
        <input
          value={to}
          onChange={e => setTo(e.target.value)}
          placeholder="Куда?"
          className="w-full bg-white/5 border border-white/10 focus:border-yellow-400/60 rounded-2xl px-4 py-3 text-white text-sm outline-none placeholder-white/40 transition-colors"
        />

        {/* Имя + Телефон */}
        <div className="grid grid-cols-2 gap-2">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ваше имя"
            className="w-full bg-white/5 border border-white/10 focus:border-yellow-400/60 rounded-2xl px-4 py-2.5 text-white text-sm outline-none placeholder-white/40 transition-colors"
          />
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="Номер телефона"
            inputMode="tel"
            className="w-full bg-white/5 border border-white/10 focus:border-yellow-400/60 rounded-2xl px-4 py-2.5 text-white text-sm outline-none placeholder-white/40 transition-colors"
          />
        </div>

        {/* Дата + Время */}
        <div className="grid grid-cols-2 gap-2">
          <label className="bg-white/5 border border-white/10 hover:border-yellow-400/40 rounded-2xl px-4 py-2 text-white text-sm cursor-pointer transition-colors block">
            <span className="text-[10px] text-white/50 block leading-tight">Дата поездки</span>
            <span className="text-sm font-semibold leading-tight">{date}</span>
            <input
              type="date"
              value={date.split("-").reverse().join("-")}
              onChange={e => {
                const v = e.target.value;
                if (v) {
                  const [y, m, d] = v.split("-");
                  setDate(`${d}-${m}-${y}`);
                }
              }}
              className="hidden"
            />
          </label>
          <label className="bg-white/5 border border-white/10 hover:border-yellow-400/40 rounded-2xl px-4 py-2 text-white text-sm cursor-pointer transition-colors block">
            <span className="text-[10px] text-white/50 block leading-tight">Во сколько?</span>
            <span className="text-sm font-semibold leading-tight">{time}</span>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="hidden"
            />
          </label>
        </div>

        {/* Тарифы */}
        <div className="grid grid-cols-3 gap-1.5">
          {TARIFFS.map(t => {
            const active = tariff === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTariff(t.id)}
                className={`rounded-xl px-2 py-2.5 flex flex-col items-center gap-1 border transition-all ${
                  active
                    ? "bg-yellow-400/15 border-yellow-400/60"
                    : "bg-white/5 border-white/10 hover:border-white/30"
                }`}
              >
                <Icon
                  name={t.icon}
                  size={20}
                  fallback="Car"
                  className={active ? "text-yellow-300" : "text-white/70"}
                />
                <span className={`text-[11px] font-medium leading-tight ${active ? "text-yellow-300" : "text-white"}`}>
                  {t.label}
                </span>
                <span className="text-[10px] text-white/30 leading-tight">—</span>
              </button>
            );
          })}
        </div>

        {/* Ошибка / успех */}
        {error && (
          <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
            <Icon name="AlertCircle" size={13} /> {error}
          </div>
        )}
        {sent && (
          <div className="flex items-center gap-2 text-emerald-400 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
            <Icon name="CheckCircle2" size={13} /> Заявка отправлена в Telegram
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center gap-2 pt-1">
          <a
            href="tel:+79843348724"
            className="w-10 h-10 shrink-0 rounded-full bg-yellow-400/15 border border-yellow-400/40 flex items-center justify-center text-yellow-300 hover:bg-yellow-400/25 transition-colors"
            aria-label="Позвонить"
          >
            <Icon name="Phone" size={16} />
          </a>
          <button
            onClick={handleSubmit}
            disabled={sending}
            className="flex-1 py-3 rounded-full bg-yellow-400/90 hover:bg-yellow-400 text-black text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {sending ? (
              <>
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Отправка...
              </>
            ) : (
              <>
                <Icon name="Send" size={15} />
                Отправить
              </>
            )}
          </button>
          <button
            type="button"
            className="w-10 h-10 shrink-0 rounded-full bg-white/5 border border-white/10 hover:border-white/30 flex items-center justify-center text-white/60 transition-colors"
            aria-label="Доп. опции"
          >
            <Icon name="SlidersHorizontal" size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default OrderForm;
