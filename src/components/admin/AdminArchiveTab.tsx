import { useEffect, useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { DISPATCH_ORDER_URL } from "./adminTypes";
import { ArchivedOrder, OrderForm, orderStatusBadge } from "./dispatch/dispatchTypes";
import { useExpirySweep } from "./useExpirySweep";

interface ArchiveTabProps {
  token: string;
  onEdit: (order: OrderForm, id: number) => void;
}

export function AdminArchiveTab({ token, onEdit }: ArchiveTabProps) {
  const [orders, setOrders] = useState<ArchivedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [filter, setFilter] = useState<"all" | "selling" | "done" | "cancelled">("all");

  // Пока открыта вкладка — проверяем просрочки оплаты и передаём заказ следующему.
  useExpirySweep(true);

  const matchesFilter = (o: ArchivedOrder) => {
    const sale = o.sale_status || "archived";
    if (filter === "all") return true;
    if (filter === "selling") return sale === "selling";
    if (filter === "done") return sale === "sold";
    if (filter === "cancelled") return sale === "no_cars" || sale === "cancelled";
    return true;
  };

  const FILTERS: { id: typeof filter; label: string }[] = [
    { id: "all", label: "Все" },
    { id: "selling", label: "На продаже" },
    { id: "done", label: "Завершён" },
    { id: "cancelled", label: "Отменён" },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${DISPATCH_ORDER_URL}?action=archive_list`, {
        headers: { "X-Admin-Token": token },
      });
      const j = await r.json();
      if (j.ok) setOrders(j.orders || []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function sendToSale(o: ArchivedOrder) {
    setBusyId(o.id);
    setMsg(null);
    try {
      const r = await fetch(`${DISPATCH_ORDER_URL}?action=send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify({ ...o }),
      });
      const j = await r.json();
      if (j.ok) {
        setMsg({ ok: true, text: "Отправлено на продажу в Telegram" });
        setOrders((prev) => prev.filter((x) => x.id !== o.id));
      } else {
        setMsg({ ok: false, text: j.error || "Не удалось отправить" });
      }
    } catch {
      setMsg({ ok: false, text: "Ошибка сети" });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(o: ArchivedOrder) {
    if (!confirm("Удалить заказ из архива?")) return;
    setBusyId(o.id);
    try {
      const r = await fetch(`${DISPATCH_ORDER_URL}?action=archive_delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify({ id: o.id }),
      });
      const j = await r.json();
      if (j.ok) setOrders((prev) => prev.filter((x) => x.id !== o.id));
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(o: ArchivedOrder) {
    if (!confirm("Отменить заказ? В группе он будет помечен «Отменён диспетчером».")) return;
    setBusyId(o.id);
    setMsg(null);
    try {
      const r = await fetch(`${DISPATCH_ORDER_URL}?action=cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify({ id: o.id }),
      });
      const j = await r.json();
      if (j.ok) {
        setMsg({ ok: true, text: "Заказ отменён" });
        setOrders((prev) => prev.map((x) => x.id === o.id ? { ...x, sale_status: "cancelled" } : x));
      } else {
        setMsg({ ok: false, text: j.error || "Не удалось отменить" });
      }
    } finally {
      setBusyId(null);
    }
  }

  function routeText(o: ArchivedOrder) {
    const a = o.from_city || o.from_address;
    const b = o.to_city || o.to_address;
    if (a && b) return `${a} → ${b}`;
    return a || b || "Без маршрута";
  }

  return (
    <div className="space-y-3 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg grad-btn flex items-center justify-center">
            <Icon name="Archive" size={16} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white leading-tight">Архив предзаказов</h2>
            <p className="text-[11px] text-muted-foreground">{orders.length} заказ(ов)</p>
          </div>
        </div>
        <button onClick={load} className="px-3 py-1.5 rounded-lg border border-white/10 text-muted-foreground hover:text-white text-sm flex items-center gap-1.5 transition-colors">
          <Icon name="RefreshCw" size={14} />Обновить
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const count = f.id === "all" ? orders.length : orders.filter((o) => {
            const sale = o.sale_status || "archived";
            if (f.id === "selling") return sale === "selling";
            if (f.id === "done") return sale === "sold";
            if (f.id === "cancelled") return sale === "no_cars" || sale === "cancelled";
            return false;
          }).length;
          return (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                filter === f.id ? "grad-btn shadow" : "border border-white/10 text-muted-foreground hover:text-white"
              }`}>
              {f.label} <span className="opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {msg && (
        <div className={`text-[13px] rounded-lg px-3 py-2 ${msg.ok ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Загрузка...</div>
      ) : orders.filter(matchesFilter).length === 0 ? (
        <div className="glass rounded-2xl border border-white/5 p-8 text-center text-sm text-muted-foreground">
          Нет заказов в этой категории
        </div>
      ) : (
        <div className="space-y-2">
          {orders.filter(matchesFilter).map((o) => (
            <div key={o.id} className="glass rounded-xl border border-white/5 p-3 flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 min-w-0">
                {(() => {
                  const b = orderStatusBadge(o);
                  return (
                    <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-md mb-1 ${b.cls}`}>
                      {b.label}
                    </span>
                  );
                })()}
                <div className="text-sm font-semibold text-white truncate">{routeText(o)}</div>
                <div className="text-[12px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  {o.date && <span>📅 {o.date}{o.time ? ` ${o.time}` : ""}</span>}
                  {o.price && <span>💰 {o.price} ₽</span>}
                  {o.tariff && <span>🎫 {o.tariff}</span>}
                  {o.client_phone && <span>📞 {o.client_phone}</span>}
                </div>
                {o.winner_user_id && (
                  <div className="text-[12px] text-emerald-400 mt-1 flex items-center gap-1.5">
                    <Icon name="UserCheck" size={13} />
                    Купил:{" "}
                    {o.winner_username ? (
                      <a href={`https://t.me/${o.winner_username}`} target="_blank" rel="noreferrer"
                        className="font-medium hover:underline">@{o.winner_username}</a>
                    ) : (
                      <span className="font-medium">{o.winner_first_name || `ID ${o.winner_user_id}`}</span>
                    )}
                  </div>
                )}
                {!!o.refunds_count && o.refunds_count > 0 && (
                  <div className="text-[12px] text-amber-400 mt-1 flex items-center gap-1.5">
                    <Icon name="Undo2" size={13} />
                    Возврат комиссии: {o.refunds_count}{" "}
                    {o.refunds_count === 1 ? "водителю" : "водителям"}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => sendToSale(o)} disabled={busyId === o.id}
                  className="grad-btn px-3 py-1.5 rounded-lg text-[13px] font-medium flex items-center gap-1.5 disabled:opacity-60">
                  <Icon name="Send" size={13} />На продажу
                </button>
                <button onClick={() => onEdit(o, o.id)} disabled={busyId === o.id}
                  className="px-2.5 py-1.5 rounded-lg border border-white/10 text-muted-foreground hover:text-white text-[13px] flex items-center gap-1.5 transition-colors">
                  <Icon name="Pencil" size={13} />
                </button>
                {o.sale_status === "selling" && (
                  <button onClick={() => cancel(o)} disabled={busyId === o.id}
                    className="px-2.5 py-1.5 rounded-lg border border-white/10 text-muted-foreground hover:text-amber-400 hover:border-amber-400/40 text-[13px] flex items-center gap-1.5 transition-colors">
                    <Icon name="Ban" size={13} />Отменить
                  </button>
                )}
                <button onClick={() => remove(o)} disabled={busyId === o.id}
                  className="px-2.5 py-1.5 rounded-lg border border-white/10 text-muted-foreground hover:text-red-400 hover:border-red-400/40 text-[13px] transition-colors">
                  <Icon name="Trash2" size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminArchiveTab;