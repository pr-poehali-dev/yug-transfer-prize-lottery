import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import { CLIENT_CABINET_URL } from "@/components/admin/adminTypes";

const BG = "https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/0ea8c632-dfa9-4e5c-8051-74474ecd91aa.jpg";

const Index = () => {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    from_city: "",
    to_city: "",
    trip_date: "",
    trip_time: "",
    people: "",
    comment: "",
  });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

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
      <div className="absolute inset-0 bg-black/50" />

      <header className="sticky top-4 z-20 mx-auto w-[calc(100%-2rem)] max-w-5xl">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md shadow-lg">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Icon name="Car" size={18} className="text-white" />
            </div>
            <span className="font-bold text-white text-base md:text-lg">Мой Трансфер</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/cabinet">
              <Button size="sm" variant="secondary" className="gap-1.5 text-xs h-8 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-white border border-white/20">
                <Icon name="UserRound" size={14} />
                <span className="hidden sm:inline">Личный кабинет</span>
              </Button>
            </Link>
            <Link to="/admin">
              <Button size="sm" variant="secondary" className="gap-1.5 text-xs h-8 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-white border border-white/20">
                <Icon name="LogIn" size={14} />
                <span className="hidden sm:inline">Админ-панель</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-5xl mx-auto px-4 pt-16 pb-16 flex flex-col items-center">
        <div className="text-center space-y-3 mb-8">
          <h1 className="text-4xl md:text-6xl font-bold text-white drop-shadow-lg">МОЙ ТРАНСФЕР</h1>
          <p className="text-lg text-white/90 drop-shadow">Трансферы по всему югу России</p>
        </div>

        <div className="w-full max-w-lg glass rounded-3xl border border-white/15 p-6 backdrop-blur-md bg-white/10">
          {sent ? (
            <div className="text-center py-6 space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40">
                <Icon name="Check" size={32} className="text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Заявка отправлена!</h2>
              <p className="text-white/70 text-sm">
                Мы подберём водителя и свяжемся с вами. Следить за статусом можно в личном кабинете.
              </p>
              <Link to="/cabinet">
                <Button className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-500">
                  <Icon name="UserRound" size={16} />
                  Перейти в личный кабинет
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-white mb-1 text-center">Оставить заявку на трансфер</h2>
              <p className="text-white/60 text-sm text-center mb-5">Заполните форму — мы подберём водителя</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={form.name} onChange={(e) => set("name", e.target.value)}
                    placeholder="Ваше имя"
                    className="bg-white/10 border border-white/15 rounded-xl px-3 py-2.5 text-white placeholder-white/40 text-sm outline-none focus:border-emerald-500/50"
                  />
                  <input
                    value={form.phone} onChange={(e) => set("phone", e.target.value)}
                    placeholder="+7 999 123-45-67" type="tel"
                    className="bg-white/10 border border-white/15 rounded-xl px-3 py-2.5 text-white placeholder-white/40 text-sm outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={form.from_city} onChange={(e) => set("from_city", e.target.value)}
                    placeholder="Откуда"
                    className="bg-white/10 border border-white/15 rounded-xl px-3 py-2.5 text-white placeholder-white/40 text-sm outline-none focus:border-emerald-500/50"
                  />
                  <input
                    value={form.to_city} onChange={(e) => set("to_city", e.target.value)}
                    placeholder="Куда"
                    className="bg-white/10 border border-white/15 rounded-xl px-3 py-2.5 text-white placeholder-white/40 text-sm outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <input
                    value={form.trip_date} onChange={(e) => set("trip_date", e.target.value)}
                    placeholder="Дата" type="date"
                    className="bg-white/10 border border-white/15 rounded-xl px-3 py-2.5 text-white placeholder-white/40 text-sm outline-none focus:border-emerald-500/50 [color-scheme:dark]"
                  />
                  <input
                    value={form.trip_time} onChange={(e) => set("trip_time", e.target.value)}
                    placeholder="Время" type="time"
                    className="bg-white/10 border border-white/15 rounded-xl px-3 py-2.5 text-white placeholder-white/40 text-sm outline-none focus:border-emerald-500/50 [color-scheme:dark]"
                  />
                  <input
                    value={form.people} onChange={(e) => set("people", e.target.value)}
                    placeholder="Чел." inputMode="numeric"
                    className="bg-white/10 border border-white/15 rounded-xl px-3 py-2.5 text-white placeholder-white/40 text-sm outline-none focus:border-emerald-500/50"
                  />
                </div>
                <textarea
                  value={form.comment} onChange={(e) => set("comment", e.target.value)}
                  placeholder="Комментарий (необязательно)" rows={2}
                  className="w-full bg-white/10 border border-white/15 rounded-xl px-3 py-2.5 text-white placeholder-white/40 text-sm outline-none focus:border-emerald-500/50 resize-none"
                />
                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-red-300 text-xs flex items-center gap-2">
                    <Icon name="AlertCircle" size={14} />{error}
                  </div>
                )}
                <Button
                  onClick={submit} disabled={loading}
                  className="w-full py-6 text-base bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90"
                >
                  {loading ? "Отправка..." : "Отправить заявку"}
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
