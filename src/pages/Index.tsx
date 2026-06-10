import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import { CLIENT_CABINET_URL } from "@/components/admin/adminTypes";

const BG = "https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/0ea8c632-dfa9-4e5c-8051-74474ecd91aa.jpg";
const PHONE = "+7 (990) 201-20-35";
const TG_LINK = "https://t.me/";
const WA_LINK = "https://wa.me/79902012035";
const TARIFFS = ["Срочный", "Стандарт", "Комфорт", "Минивэн", "Бизнес"];
const COUNTS = ["1", "2", "3", "4", "5", "6", "7", "8"];

const inputCls =
  "w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 text-sm outline-none focus:border-amber-500/60 transition-colors [color-scheme:dark]";

const Index = () => {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    trip_date: "",
    trip_time: "",
    from_city: "",
    to_city: "",
    people: "1",
    baggage: "1",
    tariff: "Срочный",
    child_seat: false,
    booster: false,
    animals: false,
    comment: "",
  });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (form.phone.replace(/\D/g, "").length < 11) {
      setError("Укажите телефон в формате +7XXXXXXXXXX");
      return;
    }
    if (!form.from_city || !form.to_city) {
      setError("Укажите маршрут — откуда и куда");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${CLIENT_CABINET_URL}?action=create_request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!d.ok) {
        setError(d.error || "Не удалось отправить заявку");
        return;
      }
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-fixed relative"
      style={{ backgroundImage: `url(${BG})` }}
    >
      <div className="absolute inset-0 bg-black/70" />

      <header className="relative z-20 mx-auto w-full max-w-6xl px-5 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="Car" size={26} className="text-amber-400" />
          <span className="font-bold text-white text-lg md:text-xl tracking-wide">TRANSFER AVTO</span>
        </div>
        <div className="flex items-center gap-3">
          <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="font-bold text-white text-base md:text-xl hover:text-amber-400 transition-colors">
            {PHONE}
          </a>
          <a href={TG_LINK} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full bg-sky-500/90 hover:bg-sky-500 flex items-center justify-center text-white">
            <Icon name="Send" size={16} />
          </a>
          <a href={WA_LINK} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full bg-green-500/90 hover:bg-green-500 flex items-center justify-center text-white">
            <Icon name="MessageCircle" size={16} />
          </a>
        </div>
      </header>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-16 grid lg:grid-cols-2 gap-8 items-start">
        <div className="flex flex-col justify-center pt-6 lg:pt-24">
          <div className="bg-black/55 backdrop-blur-sm rounded-2xl p-7 max-w-md">
            <h2 className="text-amber-400 text-2xl md:text-3xl font-bold mb-3">Сервис приема заказов</h2>
            <p className="text-white text-lg md:text-xl leading-snug">
              Заполнив форму, вы сможете узнать стоимость вашего маршрута
            </p>
            <div className="text-center text-white/70 my-4 text-lg">или</div>
            <a href={TG_LINK} target="_blank" rel="noreferrer">
              <Button className="w-full py-6 text-base bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white border border-amber-500/40">
                <Icon name="Send" size={18} className="mr-2" />
                Напишите нам в телеграм
              </Button>
            </a>
            <div className="mt-5 flex items-center gap-3 text-xs text-white/60">
              <Link to="/cabinet" className="hover:text-amber-400 flex items-center gap-1">
                <Icon name="UserRound" size={13} /> Личный кабинет
              </Link>
              <span>•</span>
              <Link to="/admin" className="hover:text-amber-400 flex items-center gap-1">
                <Icon name="LogIn" size={13} /> Админ-панель
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-[#1a1a1a]/95 backdrop-blur rounded-2xl border border-white/10 shadow-2xl p-6 md:p-8">
          {sent ? (
            <div className="text-center py-8 space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/40">
                <Icon name="Check" size={32} className="text-amber-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">Заявка отправлена!</h2>
              <p className="text-white/70 text-sm">
                Мы рассчитаем стоимость и свяжемся с вами. Статус заявки можно отследить в личном кабинете.
              </p>
              <Link to="/cabinet">
                <Button className="gap-2 bg-gradient-to-r from-amber-600 to-amber-500 text-white">
                  <Icon name="UserRound" size={16} />
                  Перейти в личный кабинет
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl md:text-3xl font-bold text-amber-400 text-center mb-6">Оставить заявку</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Как вас зовут" className={inputCls} />
                  <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+7 (987) 777-77-77" type="tel" className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input value={form.trip_date} onChange={(e) => set("trip_date", e.target.value)} type="date" className={inputCls} />
                  <input value={form.trip_time} onChange={(e) => set("trip_time", e.target.value)} type="time" className={inputCls} />
                </div>
                <input value={form.from_city} onChange={(e) => set("from_city", e.target.value)} placeholder="Откуда вас забрать?" className={inputCls} />
                <input value={form.to_city} onChange={(e) => set("to_city", e.target.value)} placeholder="Куда довезти?" className={inputCls} />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white/80 text-sm font-medium mb-1.5">Кол-во человек</label>
                    <select value={form.people} onChange={(e) => set("people", e.target.value)} className={inputCls}>
                      {COUNTS.map((c) => <option key={c} value={c} className="bg-[#1a1a1a]">{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-white/80 text-sm font-medium mb-1.5">Кол-во багажа</label>
                    <select value={form.baggage} onChange={(e) => set("baggage", e.target.value)} className={inputCls}>
                      {["0", ...COUNTS].map((c) => <option key={c} value={c} className="bg-[#1a1a1a]">{c}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-white/80 text-sm font-medium mb-1.5">Выберите тариф</label>
                  <select value={form.tariff} onChange={(e) => set("tariff", e.target.value)} className={inputCls}>
                    {TARIFFS.map((t) => <option key={t} value={t} className="bg-[#1a1a1a]">{t}</option>)}
                  </select>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
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
                        className="w-4 h-4 accent-amber-500"
                      />
                      {c.label}
                    </label>
                  ))}
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-300 text-xs flex items-center gap-2">
                    <Icon name="AlertCircle" size={14} />{error}
                  </div>
                )}

                <Button
                  onClick={submit} disabled={loading}
                  className="w-full py-6 text-base font-semibold bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white"
                >
                  {loading ? "Отправка..." : "Отправить"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
