import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import { RAFFLES_URL, GRADIENTS, ICONS, EMPTY_FORM, RaffleDB } from "./adminTypes";

export function RaffleFormModal({ initial, token, onSave, onClose }: {
  initial?: RaffleDB; token: string;
  onSave: (r: RaffleDB) => void; onClose: () => void;
}) {
  const [form, setForm] = useState(initial ? {
    title: initial.title, prize: initial.prize, prize_icon: initial.prize_icon,
    end_date: initial.end_date, participants: initial.participants, min_amount: initial.min_amount,
    status: initial.status, gradient: initial.gradient, winner: initial.winner || "",
    photo_url: initial.photo_url || "",
  } : { ...EMPTY_FORM, photo_url: "" });
  const [photoPreview, setPhotoPreview] = useState<string>(initial?.photo_url || "");
  const [photoData, setPhotoData] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result as string;
      setPhotoPreview(data);
      setPhotoData(data);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError("");
    try {
      const method = initial ? "PUT" : "POST";
      const body = initial ? { ...form, id: initial.id } : form;
      if (photoData) (body as Record<string, string>).photo_data = photoData;
      const res = await fetch(RAFFLES_URL, {
        method, headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) onSave(data.raffle);
      else setError(data.error || "Ошибка");
    } catch { setError("Нет соединения"); }
    finally { setLoading(false); }
  };

  const inputCls = "w-full bg-white/5 border border-white/10 focus:border-purple-500/60 rounded-xl px-4 py-2.5 text-white placeholder-muted-foreground text-sm outline-none transition-colors";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in" style={{ animationFillMode: "forwards" }}>
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 rounded-3xl blur-lg opacity-30" />
        <div className="relative glass rounded-3xl border border-white/10">
          <div className="h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400" />
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-oswald text-xl font-bold text-white">{initial ? "Редактировать" : "Новый розыгрыш"}</h3>
              <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-white transition-colors">
                <Icon name="X" size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Фото розыгрыша */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wider">Фото розыгрыша</label>
                <div className="flex items-center gap-3">
                  <div
                    className="w-24 h-24 rounded-xl border-2 border-dashed border-white/20 flex items-center justify-center cursor-pointer hover:border-purple-500/60 transition-colors overflow-hidden shrink-0"
                    onClick={() => fileRef.current?.click()}
                  >
                    {photoPreview ? (
                      <img src={photoPreview} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center">
                        <Icon name="ImagePlus" size={24} className="text-muted-foreground mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">Загрузить</p>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-white mb-1">Фото для карточки и поста в канал</p>
                    <p className="text-xs text-muted-foreground mb-2">JPG или PNG, до 5 МБ</p>
                    <button type="button" onClick={() => fileRef.current?.click()}
                      className="text-xs px-3 py-1.5 rounded-xl border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 transition-colors">
                      {photoPreview ? "Изменить фото" : "Выбрать фото"}
                    </button>
                    {photoPreview && (
                      <button type="button" onClick={() => { setPhotoPreview(""); setPhotoData(""); set("photo_url", ""); }}
                        className="ml-2 text-xs px-3 py-1.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">
                        Удалить
                      </button>
                    )}
                  </div>
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wider">Название</label>
                <input required value={form.title} onChange={e => set("title", e.target.value)} placeholder="Например: Розыгрыш iPhone" className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wider">Приз</label>
                <input required value={form.prize} onChange={e => set("prize", e.target.value)} placeholder="Например: iPhone 16 Pro Max" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wider">Мин. взнос (₽)</label>
                  <input required type="number" min={1} value={form.min_amount} onChange={e => set("min_amount", Number(e.target.value))} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wider">Дата окончания</label>
                  <input required type="date" value={form.end_date} onChange={e => set("end_date", e.target.value)} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wider">Статус</label>
                <select value={form.status} onChange={e => set("status", e.target.value)} className={inputCls}>
                  <option value="active">Активен</option>
                  <option value="upcoming">Скоро</option>
                  <option value="ended">Завершён</option>
                </select>
              </div>
              {form.status === "ended" && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wider">Победитель</label>
                  <input value={form.winner} onChange={e => set("winner", e.target.value)} placeholder="Имя победителя" className={inputCls} />
                </div>
              )}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wider">Иконка</label>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map(ic => (
                    <button key={ic} type="button" onClick={() => set("prize_icon", ic)}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${form.prize_icon === ic ? "bg-purple-500/40 border border-purple-500/60" : "bg-white/5 border border-white/10 hover:bg-white/10"}`}>
                      <Icon name={ic as string} size={16} className="text-white" fallback="Gift" />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wider">Цвет карточки</label>
                <div className="flex flex-wrap gap-2">
                  {GRADIENTS.map(g => (
                    <button key={g} type="button" onClick={() => set("gradient", g)}
                      className={`w-8 h-8 rounded-xl bg-gradient-to-br ${g} transition-all ${form.gradient === g ? "ring-2 ring-white/60 scale-110" : "opacity-70 hover:opacity-100"}`} />
                  ))}
                </div>
              </div>
              {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-white/10 text-muted-foreground hover:text-white hover:bg-white/5 transition-all text-sm font-medium">Отмена</button>
                <button type="submit" disabled={loading} className="flex-1 grad-btn rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-70">
                  {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Icon name={initial ? "Save" : "Plus"} size={15} />}
                  {initial ? "Сохранить" : "Создать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
