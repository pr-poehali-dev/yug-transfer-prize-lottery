import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/icon";
import { ADMIN_DRIVER_SUBS_URL, DriverSub, PaymentRow } from "./adminTypes";

export function AdminDriversTab({ token }: { token: string }) {
  const [subs, setSubs] = useState<DriverSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalActive, setTotalActive] = useState(0);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalRefund, setTotalRefund] = useState(0);

  const fetchSubs = async () => {
    setLoading(true);
    try {
      const [resSubs, resPay] = await Promise.all([
        fetch(ADMIN_DRIVER_SUBS_URL, { headers: { "X-Admin-Token": token } }),
        fetch(`${ADMIN_DRIVER_SUBS_URL}?action=payments`, { headers: { "X-Admin-Token": token } }),
      ]);
      const data = await resSubs.json();
      if (data.ok) {
        setSubs(data.subs || []);
        setTotalActive(data.total_active || 0);
      }
      const pay = await resPay.json();
      if (pay.ok) {
        setPayments(pay.payments || []);
        setTotalIncome(pay.total_income || 0);
        setTotalRefund(pay.total_refund || 0);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubs();
  }, []);

  const PAYMENT_META: Record<PaymentRow["kind"], { label: string; cls: string; icon: string }> = {
    commission: { label: "Комиссия", cls: "bg-emerald-500/10 text-emerald-400", icon: "BadgeDollarSign" },
    subscription: { label: "Подписка", cls: "bg-purple-500/10 text-purple-300", icon: "Crown" },
    refund: { label: "Возврат", cls: "bg-amber-500/10 text-amber-400", icon: "Undo2" },
  };

  const formatDateTime = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const expiringSoon = useMemo(() => {
    const now = Date.now();
    const soon = now + 3 * 24 * 60 * 60 * 1000;
    return subs.filter((s) => {
      if (!s.is_active || !s.active_until) return false;
      const t = new Date(s.active_until).getTime();
      return t > now && t <= soon;
    }).length;
  }, [subs]);

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("ru-RU");
  };

  const daysLeft = (iso: string | null) => {
    if (!iso) return null;
    const diff = new Date(iso).getTime() - Date.now();
    if (diff <= 0) return null;
    return Math.ceil(diff / (24 * 60 * 60 * 1000));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-oswald text-3xl font-bold text-white">Подписки водителей</h2>
          <p className="text-white/40 text-sm mt-1">Бот @zacazubot · Группа Transfer Zone VIP</p>
        </div>
        <button onClick={fetchSubs} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm hover:bg-white/10 transition-colors">
          <Icon name="RefreshCw" size={14} className="inline mr-1" />Обновить
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Icon name="UserCheck" size={20} className="text-emerald-400" />
            </div>
            <span className="text-white/60 text-sm">Активных подписок</span>
          </div>
          <p className="text-3xl font-bold text-white">{totalActive}</p>
          <p className="text-emerald-400/80 text-xs mt-1">комиссия 10%</p>
        </div>

        <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <Icon name="Clock" size={20} className="text-orange-400" />
            </div>
            <span className="text-white/60 text-sm">Истекают за 3 дня</span>
          </div>
          <p className="text-3xl font-bold text-white">{expiringSoon}</p>
          <p className="text-orange-400/80 text-xs mt-1">скоро закончатся</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: "rgba(255,255,255,0.02)" }}>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : subs.length === 0 ? (
          <div className="text-center py-12 text-white/40 text-sm">
            Пока никто не оформил подписку.<br />
            Когда водители из группы оплатят — они появятся тут.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/3 border-b border-white/5">
                <tr className="text-white/50">
                  <th className="text-left px-4 py-3 font-medium">Водитель</th>
                  <th className="text-left px-4 py-3 font-medium">Действует до</th>
                  <th className="text-left px-4 py-3 font-medium">Осталось</th>
                  <th className="text-left px-4 py-3 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => {
                  const left = daysLeft(s.active_until);
                  return (
                    <tr key={s.tg_user_id} className="border-b border-white/5 last:border-0 hover:bg-white/3">
                      <td className="px-4 py-3">
                        <div className="text-white">{s.first_name || `ID ${s.tg_user_id}`}</div>
                        {s.username && (
                          <a href={`https://t.me/${s.username}`} target="_blank" rel="noreferrer" className="text-purple-400 text-xs hover:underline">@{s.username}</a>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white/70">{formatDate(s.active_until)}</td>
                      <td className="px-4 py-3 text-white/70">{left !== null ? `${left} дн.` : "—"}</td>
                      <td className="px-4 py-3">
                        {s.is_active ? (
                          <span className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs">Активна</span>
                        ) : (
                          <span className="px-2 py-1 rounded-lg bg-white/5 text-white/40 text-xs">Истекла</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="pt-2">
        <h3 className="font-oswald text-2xl font-bold text-white">Платежи и возвраты</h3>
        <p className="text-white/40 text-sm mt-1">Все оплаты комиссий, подписок и автовозвраты водителям</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Icon name="TrendingUp" size={20} className="text-emerald-400" />
            </div>
            <span className="text-white/60 text-sm">Поступления (комиссии + подписки)</span>
          </div>
          <p className="text-3xl font-bold text-white">{totalIncome.toLocaleString("ru-RU")} ₽</p>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Icon name="Undo2" size={20} className="text-amber-400" />
            </div>
            <span className="text-white/60 text-sm">Возвращено водителям</span>
          </div>
          <p className="text-3xl font-bold text-white">{totalRefund.toLocaleString("ru-RU")} ₽</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: "rgba(255,255,255,0.02)" }}>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-12 text-white/40 text-sm">
            Платежей пока нет.<br />
            Здесь появятся оплаты комиссий, подписок и возвраты.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/3 border-b border-white/5">
                <tr className="text-white/50">
                  <th className="text-left px-4 py-3 font-medium">Дата</th>
                  <th className="text-left px-4 py-3 font-medium">Тип</th>
                  <th className="text-left px-4 py-3 font-medium">Водитель</th>
                  <th className="text-left px-4 py-3 font-medium">Сумма</th>
                  <th className="text-left px-4 py-3 font-medium">Заказ</th>
                  <th className="text-left px-4 py-3 font-medium">Комментарий</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const meta = PAYMENT_META[p.kind];
                  const isRefund = p.kind === "refund";
                  return (
                    <tr key={p.id} className="border-b border-white/5 last:border-0 hover:bg-white/3">
                      <td className="px-4 py-3 text-white/60 whitespace-nowrap">{formatDateTime(p.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-lg text-xs inline-flex items-center gap-1 ${meta.cls}`}>
                          <Icon name={meta.icon} size={12} />{meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {p.username ? (
                          <a href={`https://t.me/${p.username}`} target="_blank" rel="noreferrer" className="text-purple-400 hover:underline">@{p.username}</a>
                        ) : (
                          <span className="text-white/70">{p.first_name || `ID ${p.tg_user_id}`}</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 font-medium whitespace-nowrap ${isRefund ? "text-amber-400" : "text-emerald-400"}`}>
                        {isRefund ? "−" : "+"}{p.amount_rub.toLocaleString("ru-RU")} ₽
                      </td>
                      <td className="px-4 py-3 text-white/60">{p.order_id ? `#${p.order_id}` : "—"}</td>
                      <td className="px-4 py-3 text-white/50 text-xs">{p.note || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminDriversTab;