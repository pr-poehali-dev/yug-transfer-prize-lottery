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
}

export const TARIFFS = ["Срочный", "Эконом", "Комфорт", "Бизнес", "Минивэн"];
export const COMMISSIONS = ["10%", "15%", "20%", "25%"];

export const EMPTY_ORDER: OrderForm = {
  from_city: "", to_city: "", from_address: "", to_address: "", stops: [],
  date: "", time: "", price: "", tariff: "Срочный", commission: "15%",
  client_phone: "", people: "1", luggage: "1",
  booster: false, child_seat: false, animal: false, comment: "",
};
