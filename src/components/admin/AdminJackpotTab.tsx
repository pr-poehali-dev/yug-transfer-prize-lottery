import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { JACKPOT_URL } from "./adminTypes";

export function AdminJackpotTab({ token }: { token: string }) {
  const [data, setData] = useState<{ balance: number; next_draw_at: string | null; last_winner: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [result, setResult] = useState<{ winner: string; amount: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(JACKPOT_URL)
      .then(r => r.json())
      .then(d => { if (d.ok) setData(d); })
      .finally(() => setLoading(false));
  }, []);

  const handleDraw = async () => {
    if (!confirm("Провести розыгрыш джекпота? Это действие необратимо — баланс обнулится и будет выбран победитель.")) return;
    setDrawing(true); setError(""); setResult(null);
    try {
      const res = await fetch(JACKPOT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify({}),
      });
      const d = await res.json();
      if (d.ok) {
        setResult({ winner: d.winner, amount: d.amount });
        setData(prev => prev ? { ...prev, balance: 0, last_winner: d.winner } : prev);
      } else {
        setError(d.error || "Ошибка");
      }
    } catch { setError("Нет соединения"); }
    finally { setDrawing(false); }
  };

  return (
    <div className="max-w-xl">
      <h2 className="font-oswald text-3xl font-bold text-white mb-6">Джекпот</h2>

      <div className="glass rounded-2xl p-6 mb-4 border border-yellow-500/20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-orange-500/5 pointer-events-none" />
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Текущий баланс</p>
        {loading ? (
          <div className="w-6 h-6 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin my-2" />
        ) : (
          <p className="font-oswald text-4xl font-bold"
            style={{ background: "linear-gradient(135deg,#fbbf24,#f97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            {(data?.balance ?? 0).toLocaleString("ru")} ₽
          </p>
        )}
        {data?.next_draw_at && (
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
            <Icon name="Calendar" size={13} />
            Следующий розыгрыш: {new Date(data.next_draw_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        )}
        {data?.last_winner && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <Icon name="Trophy" size={13} className="text-yellow-400" />
            Последний победитель: <span className="text-yellow-400 font-medium">{data.last_winner}</span>
          </p>
        )}
      </div>

      {result && (
        <div className="glass rounded-2xl p-5 mb-4 border border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center gap-3">
            <div className="text-4xl">🏆</div>
            <div>
              <p className="text-emerald-400 font-bold text-lg">{result.winner}</p>
              <p className="text-muted-foreground text-sm">Выиграл {result.amount.toLocaleString("ru")} ₽</p>
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <button
        onClick={handleDraw}
        disabled={drawing || (data?.balance ?? 0) <= 0}
        className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {drawing
          ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Розыгрыш...</>
          : <><Icon name="Gem" size={18} />Провести розыгрыш джекпота</>
        }
      </button>
      {(data?.balance ?? 0) <= 0 && !loading && (
        <p className="text-xs text-muted-foreground text-center mt-2">Баланс пуст — розыгрыш недоступен</p>
      )}
    </div>
  );
}
