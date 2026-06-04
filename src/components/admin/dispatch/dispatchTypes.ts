export interface OrderForm {
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

export interface ArchivedOrder extends OrderForm {
  id: number;
  created_at: string | null;
  sale_status?: string;
  trip_status?: string;
  winner_user_id?: number | null;
  winner_username?: string;
  winner_first_name?: string;
}

export interface StatusBadge {
  label: string;
  cls: string;
}

export function orderStatusBadge(o: { sale_status?: string; trip_status?: string }): StatusBadge {
  const trip = o.trip_status || "";
  if (trip === "done") return { label: "Заказ завершён", cls: "bg-zinc-500/15 text-zinc-300" };
  if (trip === "in_progress") return { label: "🚗 Клиент в машине", cls: "bg-blue-500/15 text-blue-400" };
  if (trip === "waiting_pickup") return { label: "Оплачен, ждёт подачи", cls: "bg-emerald-500/15 text-emerald-400" };

  const sale = o.sale_status || "archived";
  if (sale === "sold") return { label: "Куплен", cls: "bg-emerald-500/15 text-emerald-400" };
  if (sale === "selling") return { label: "🟢 На продаже", cls: "bg-purple-500/15 text-purple-300" };
  if (sale === "no_cars") return { label: "❌ Нет машин — отменён", cls: "bg-red-500/15 text-red-400" };
  if (sale === "cancelled") return { label: "🚫 Отменён диспетчером", cls: "bg-red-500/15 text-red-400" };
  return { label: "В архиве", cls: "bg-white/10 text-muted-foreground" };
}

export const TARIFFS = ["Стандарт", "Срочный", "Комфорт", "Бизнес", "Минивэн"];
export const COMMISSIONS = ["10%", "15%", "20%", "25%"];

export const EMPTY_ORDER: OrderForm = {
  from_city: "", to_city: "", from_address: "", to_address: "", stops: [],
  date: "", time: "", price: "", tariff: "Стандарт", commission: "15%",
  client_phone: "", people: "1", luggage: "1",
  booster: false, child_seat: false, animal: false, comment: "",
};