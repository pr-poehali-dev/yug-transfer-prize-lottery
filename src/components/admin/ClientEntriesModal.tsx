import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { Client, ADMIN_CLIENTS_URL } from "./adminTypes";

interface Entry {
  id: number;
  raffle_title: string;
  raffle_prize: string;
  raffle_icon: string;
  raffle_photo: string | null;
  raffle_status: string;
  raffle_gradient: string;
  winner: string | null;
  tickets: number;
  amount: number;
  created_at: string;
}

interface Props {
  client: Client;
  token: string;
  onClose: () => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

export function ClientEntriesModal({ client, token, onClose }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${ADMIN_CLIENTS_URL}?action=entries&user_id=${client.id}`, {
      headers: { "X-Admin-Token": token },
    })
      .then(r => r.json())
      .then(d => { if (d.ok) setEntries(d.entries || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [client.id]);

  const totalSpent = entries.reduce((s, e) => s + e.amount, 0);
  const activeCount = entries.filter(e => e.raffle_status === "active").length;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative w-full max-w-lg max-h-[85vh] flex flex-col animate-fade-in-up" style={{ animationFillMode: "forwards" }}>
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 rounded-3xl blur-lg opacity-30 pointer-events-none" />

        <div className="relative glass rounded-3xl border border-white/10 flex flex-col overflow-hidden">
          {/* Шапка */}
          <div className="flex items-center gap-3 p-5 border-b border-white/5 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold shrink-0 overflow-hidden">
              {client.photo_url
                ? <img src={client.photo_url} alt="" className="w-full h-full object-cover" />
                : (client.first_name[0] || "?").toUpperCase()
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold">{client.first_name} {client.last_name}</p>
              <p className="text-xs text-muted-foreground">
                {client.phone ? `📱 +${client.phone}` : client.username ? `@${client.username}` : `ID: ${client.id}`}
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-white transition-colors">
              <Icon name="X" size={16} />
            </button>
          </div>

          {/* Статистика */}
          {!loading && entries.length > 0 && (
            <div className="grid grid-cols-3 gap-3 p-4 border-b border-white/5 shrink-0">
              {[
                { label: "Всего участий", value: entries.length },
                { label: "Потрачено", value: `${totalSpent.toLocaleString("ru")} ₽` },
                { label: "Активных", value: activeCount },
              ].map(s => (
                <div key={s.label} className="bg-white/5 rounded-xl p-3 text-center">
                  <p className="text-white font-bold text-lg">{s.value}</p>
                  <p className="text-muted-foreground text-xs">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Список участий */}
          <div className="overflow-y-auto flex-1 p-4 space-y-2">
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-10">
                <div className="text-4xl mb-2">🎫</div>
                <p className="text-muted-foreground text-sm">Участий пока нет</p>
              </div>
            ) : entries.map(e => (
              <div key={e.id} className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                <div className="w-12 h-12 rounded-lg shrink-0 overflow-hidden bg-white/5 flex items-center justify-center">
                  {e.raffle_photo
                    ? <img src={e.raffle_photo} alt={e.raffle_title} className="w-full h-full object-cover" />
                    : <span className="text-2xl">{e.raffle_icon || "🎁"}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{e.raffle_title}</p>
                  <p className="text-muted-foreground text-xs truncate">{e.raffle_prize}</p>
                  <p className="text-muted-foreground text-xs">{formatDate(e.created_at)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-white font-bold text-sm">{e.amount.toLocaleString("ru")} ₽</p>
                  <p className="text-muted-foreground text-xs">{e.tickets} билет{e.tickets === 1 ? "" : "а"}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    e.raffle_status === "active"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-white/10 text-muted-foreground"
                  }`}>
                    {e.raffle_status === "active" ? "Активен" : "Завершён"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
