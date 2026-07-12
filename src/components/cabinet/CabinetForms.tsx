import { useState } from "react";
import Icon from "@/components/ui/icon";
import { CLIENT_CABINET_URL } from "@/components/admin/adminTypes";
import { TARIFFS, COUNTS, inputCls } from "./cabinetShared";

/* ---------------- NEW ORDER TAB ---------------- */
export function NewOrderTab({ token, onCreated }: { token: string; onCreated: () => void }) {
  const [form, setForm] = useState({
    trip_date: "", trip_time: "", from_city: "", to_city: "",
    people: "1", baggage: "1", tariff: "Срочный",
    child_seat: false, booster: false, animals: false, comment: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.from_city || !form.to_city) {
      setError("Укажите маршрут — откуда и куда");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${CLIENT_CABINET_URL}?action=create_request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Client-Token": token },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!d.ok) {
        setError(d.error || "Не удалось отправить заявку");
        return;
      }
      onCreated();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-5">Новый заказ</h1>
      <div className="bg-[#161616] rounded-2xl border border-white/10 p-5 md:p-6 max-w-2xl space-y-3">
        <input value={form.from_city} onChange={(e) => set("from_city", e.target.value)} placeholder="Откуда вас забрать?" className={inputCls} />
        <input value={form.to_city} onChange={(e) => set("to_city", e.target.value)} placeholder="Куда довезти?" className={inputCls} />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-white/70 text-xs font-medium mb-1">Дата поездки</label>
            <input value={form.trip_date} onChange={(e) => set("trip_date", e.target.value)} type="date" className={`${inputCls} ${!form.trip_date ? "text-white/40" : ""}`} />
          </div>
          <div>
            <label className="block text-white/70 text-xs font-medium mb-1">Время</label>
            <input value={form.trip_time} onChange={(e) => set("trip_time", e.target.value)} type="time" className={`${inputCls} ${!form.trip_time ? "text-white/40" : ""}`} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-white/70 text-xs font-medium mb-1">Кол-во человек</label>
            <select value={form.people} onChange={(e) => set("people", e.target.value)} className={inputCls}>
              {COUNTS.map((c) => <option key={c} value={c} className="bg-[#1a1a1a]">{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-white/70 text-xs font-medium mb-1">Кол-во багажа</label>
            <select value={form.baggage} onChange={(e) => set("baggage", e.target.value)} className={inputCls}>
              {["0", ...COUNTS].map((c) => <option key={c} value={c} className="bg-[#1a1a1a]">{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-white/70 text-xs font-medium mb-1">Выберите тариф</label>
          <select value={form.tariff} onChange={(e) => set("tariff", e.target.value)} className={inputCls}>
            {TARIFFS.map((t) => <option key={t} value={t} className="bg-[#1a1a1a]">{t}</option>)}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-1">
          {[
            { k: "child_seat", label: "Дет. кресло" },
            { k: "booster", label: "Бустер" },
            { k: "animals", label: "Животные" },
          ].map((c) => (
            <label key={c.k} className="flex items-center gap-2 text-white/90 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form[c.k as keyof typeof form] as boolean}
                onChange={(e) => set(c.k, e.target.checked)}
                className="w-4 h-4 accent-amber-500 shrink-0"
              />
              {c.label}
            </label>
          ))}
        </div>

        <textarea
          value={form.comment}
          onChange={(e) => set("comment", e.target.value)}
          placeholder="Комментарий (необязательно)"
          rows={2}
          className={`${inputCls} resize-y`}
        />

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-red-300 text-xs flex items-center gap-2">
            <Icon name="AlertCircle" size={14} />{error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold disabled:opacity-50 transition-colors"
        >
          {loading ? "Отправка..." : "Отправить заявку"}
        </button>
      </div>
    </div>
  );
}

/* ---------------- BONUS TAB ---------------- */
export function BonusTab({ doneCount, points, phone }: { doneCount: number; points: number; phone: string }) {
  const promo = phone ? `MOY${phone.slice(-4)}` : "MOYTRANSFER";
  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-5">Бонусы и кэшбэк</h1>

      <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-3xl p-6 text-black max-w-2xl mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-black/70 text-sm font-medium">Ваш баланс баллов</div>
            <div className="text-4xl font-extrabold mt-1">{points}</div>
            <div className="text-black/60 text-sm mt-1">1 балл = 1 ₽ скидки</div>
          </div>
          <Icon name="Gift" size={56} className="text-black/80" />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 max-w-2xl">
        <div className="bg-[#161616] rounded-2xl border border-white/10 p-5">
          <Icon name="Percent" size={22} className="text-amber-400 mb-2" />
          <div className="text-white font-semibold">Кэшбэк 5%</div>
          <div className="text-white/50 text-sm mt-1">Возвращаем баллами с каждой поездки</div>
        </div>
        <div className="bg-[#161616] rounded-2xl border border-white/10 p-5">
          <Icon name="Award" size={22} className="text-amber-400 mb-2" />
          <div className="text-white font-semibold">{doneCount} поездок завершено</div>
          <div className="text-white/50 text-sm mt-1">Чем больше ездите — тем больше баллов</div>
        </div>
      </div>

      <div className="bg-[#161616] rounded-2xl border border-amber-500/20 p-5 max-w-2xl mt-3">
        <div className="text-white/60 text-sm mb-2">Ваш промокод для друзей</div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-amber-400 font-bold text-xl tracking-widest bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2">
            {promo}
          </div>
          <span className="text-white/50 text-sm">Друг получит скидку, а вы — 200 баллов</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- PROFILE TAB ---------------- */
export function ProfileTab({ name, phone, onLogout }: { name: string; phone: string; onLogout: () => void }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-5">Профиль</h1>
      <div className="bg-[#161616] rounded-2xl border border-white/10 p-6 max-w-xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-amber-500/15 border-2 border-amber-500 flex items-center justify-center">
            <Icon name="UserRound" size={30} className="text-amber-400" />
          </div>
          <div>
            <div className="text-white font-bold text-xl">{name || "Клиент"}</div>
            <div className="text-white/50">{phone}</div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between border-t border-white/5 pt-3">
            <span className="text-white/50 text-sm flex items-center gap-2"><Icon name="User" size={16} className="text-amber-400" /> Имя</span>
            <span className="text-white">{name || "—"}</span>
          </div>
          <div className="flex items-center justify-between border-t border-white/5 pt-3">
            <span className="text-white/50 text-sm flex items-center gap-2"><Icon name="Phone" size={16} className="text-amber-400" /> Телефон</span>
            <span className="text-white">{phone}</span>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full mt-6 py-3.5 rounded-xl border-2 border-amber-500 text-amber-400 font-bold hover:bg-amber-500/10 transition-colors"
        >
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );
}

/* ---------------- STUB TAB ---------------- */
export function StubTab({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-5">{title}</h1>
      <div className="bg-[#161616] rounded-2xl border border-white/10 p-12 text-center max-w-2xl">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-4">
          <Icon name={icon} size={30} className="text-amber-400" />
        </div>
        <div className="text-white font-bold text-lg">Раздел в разработке</div>
        <p className="text-white/50 text-sm mt-2 max-w-md mx-auto">{text}</p>
        <span className="inline-block mt-4 text-xs px-3 py-1 rounded-full bg-white/10 text-white/50">Скоро</span>
      </div>
    </div>
  );
}
