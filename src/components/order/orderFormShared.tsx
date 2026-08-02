import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import useTariffCalc, { applySelectedTariffFromCache, clearTariffPriceCache, syncOrderPriceField } from "@/hooks/useTariffCalc";
import { useIsMobile } from "@/hooks/use-mobile";

export const BG = "https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/0ea8c632-dfa9-4e5c-8051-74474ecd91aa.jpg";
export const TARIFFS = ["Срочный", "Стандарт", "Комфорт", "Минивэн", "Бизнес", "Доставка"];
export const TARIFF_ICONS: Record<string, string> = {
  Срочный: "Zap",
  Стандарт: "Car",
  Комфорт: "CarFront",
  Минивэн: "Bus",
  Бизнес: "CarTaxiFront",
  Доставка: "Package",
};
export const COUNTS = ["1", "2", "3", "4", "5", "6", "7", "8"];

export const inputCls =
  "w-full bg-[#2a2a2a] border border-white/5 rounded-xl px-4 py-2.5 text-white placeholder-white/40 text-[15px] outline-none focus:border-amber-400/60 transition-colors [color-scheme:dark]";

// Тумблер-переключатель поверх скрытого чекбокса (name читает скрипт калькулятора).
export function Toggle({ name, label }: { name: string; label: string }) {
  const [on, setOn] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const toggle = () => {
    const next = !on;
    setOn(next);
    const cb = ref.current;
    if (cb) {
      cb.checked = next;
      cb.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };
  return (
    <button type="button" onClick={toggle} className="w-full flex items-center justify-between py-2.5 text-left">
      <span className="text-white text-[15px]">{label}</span>
      <span className={"relative w-11 h-6 rounded-full transition-colors shrink-0 " + (on ? "bg-amber-400/30" : "bg-white/10")}>
        <span className={"absolute top-1 w-4 h-4 rounded-full transition-all " + (on ? "left-6 bg-amber-400" : "left-1 bg-white/50")} />
      </span>
      <input ref={ref} type="checkbox" name={name} className="hidden" aria-hidden readOnly />
    </button>
  );
}

// Тумблер выбора способа оплаты (радио-логика управляется извне).
export function PayToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full flex items-center justify-between py-2.5 text-left">
      <span className="text-white text-[15px]">{label}</span>
      <span className={"relative w-11 h-6 rounded-full transition-colors shrink-0 " + (active ? "bg-amber-400/30" : "bg-white/10")}>
        <span className={"absolute top-1 w-4 h-4 rounded-full transition-all " + (active ? "left-6 bg-amber-400" : "left-1 bg-white/50")} />
      </span>
    </button>
  );
}

export interface OrderFormState {
  prefillFrom: string;
  prefillTo: string;
  prefillComment: string;
  formRef: React.RefObject<HTMLFormElement>;
  tarifRef: React.RefObject<HTMLSelectElement>;
  isMobile: boolean;
  tariff: string;
  panel: "main" | "extra" | "pay";
  setPanel: React.Dispatch<React.SetStateAction<"main" | "extra" | "pay">>;
  pay: "cash" | "transfer" | "account";
  setPay: React.Dispatch<React.SetStateAction<"cash" | "transfer" | "account">>;
  geoLoading: boolean;
  detectLocation: () => void;
  pickTariff: (t: string) => void;
}

// Вся логика формы заказа (state, геолокация, тарифы, валидация, оплата).
export function useOrderForm(): OrderFormState {
  const [searchParams] = useSearchParams();
  const prefillFrom = searchParams.get("from") || "";
  const prefillTo = searchParams.get("to") || "";
  const prefillComment = searchParams.get("comment") || "";

  const formRef = useRef<HTMLFormElement>(null);
  const tarifRef = useRef<HTMLSelectElement>(null);

  const isMobile = useIsMobile();

  const [tariff, setTariff] = useState(TARIFFS[0]);
  // Активная панель нижней шторки: главная / доп. опции / оплата.
  const [panel, setPanel] = useState<"main" | "extra" | "pay">("main");
  // Способ оплаты (радио-логика): Наличные / Перевод / По номеру счёта.
  const [pay, setPay] = useState<"cash" | "transfer" | "account">("transfer");
  const [geoLoading, setGeoLoading] = useState(false);

  // Штатный скрипт: подсказки, расчёт цены и отправка заявки.
  useTariffCalc(true);

  // Определение геолокации: координаты -> адрес (Яндекс) -> поле «Откуда?».
  const detectLocation = () => {
    if (geoLoading) return;
    if (!navigator.geolocation) {
      alert("Ваш браузер не поддерживает определение местоположения");
      return;
    }
    setGeoLoading(true);

    const fillStart = (address: string) => {
      const field = formRef.current?.querySelector<HTMLInputElement>('[name="place_start"]');
      if (field) {
        field.value = address;
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.dispatchEvent(new Event("change", { bubbles: true }));
      }
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const ymaps = (window as unknown as { ymaps?: { ready: (cb: () => void) => void; geocode: (c: number[]) => Promise<{ geoObjects: { get: (i: number) => { getAddressLine: () => string } | null } }> } }).ymaps;
        if (ymaps && typeof ymaps.ready === "function") {
          ymaps.ready(() => {
            ymaps
              .geocode([latitude, longitude])
              .then((res) => {
                const obj = res.geoObjects.get(0);
                fillStart(obj ? obj.getAddressLine() : `${latitude}, ${longitude}`);
                setGeoLoading(false);
              })
              .catch(() => {
                fillStart(`${latitude}, ${longitude}`);
                setGeoLoading(false);
              });
          });
        } else {
          fillStart(`${latitude}, ${longitude}`);
          setGeoLoading(false);
        }
      },
      () => {
        setGeoLoading(false);
        alert("Не удалось определить местоположение. Разрешите доступ к геолокации в настройках браузера.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Клик по карточке тарифа: если цены уже посчитаны — просто подставляем
  // стоимость выбранного тарифа в кнопку из кэша, без нового запроса.
  // Пересчитываем только если цен ещё нет (первый расчёт).
  const pickTariff = (t: string) => {
    setTariff(t);
    const sel = tarifRef.current;
    if (sel) sel.value = t;
    const applied = applySelectedTariffFromCache(t);
    if (!applied && sel) {
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };

  // Валидация обязательных полей и красная подсветка (скрипт вызывает alert —
  // перехватываем и заменяем подсветкой).
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const REQUIRED = ["place_start", "place_end", "Date", "Time", "name", "Phone"];

    const onSubmitCapture = (e: Event) => {
      const missing: HTMLInputElement[] = [];
      for (const n of REQUIRED) {
        const field = form.querySelector<HTMLInputElement>(`[name="${n}"]`);
        if (field && !field.value.trim()) missing.push(field);
      }
      if (missing.length > 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
        missing.forEach((f) => f.classList.add("!border-red-500"));
        missing[0].focus();
        return;
      }
      // Промежуточные адреса дописываем в комментарий (скрипт их не читает).
      const mids = Array.from(form.querySelectorAll<HTMLInputElement>(".js-waypoint"))
        .map((el) => el.value.trim())
        .filter(Boolean);
      if (mids.length > 0) {
        const commentEl = form.querySelector<HTMLTextAreaElement>('[name="comment"]');
        if (commentEl) {
          const base = commentEl.value.replace(/^Промежуточные адреса:[^\n]*\n?/, "").trim();
          commentEl.value = `Промежуточные адреса: ${mids.join("; ")}` + (base ? `\n${base}` : "");
        }
      }
      // Валидация ок — синхронно кладём цену в order_price ДО того,
      // как штатный скрипт (bubble-фаза) прочитает поле для заявки.
      syncOrderPriceField();
    };
    const clearErr = (e: Event) => {
      (e.target as HTMLElement)?.classList?.remove("!border-red-500");
    };
    const nativeAlert = window.alert;
    window.alert = (msg?: unknown) => {
      const text = String(msg ?? "").toLowerCase();
      const map: { keys: string[]; name: string }[] = [
        { keys: ["телефон", "phone"], name: "Phone" },
        { keys: ["имя", "зовут", "name"], name: "name" },
        { keys: ["откуда", "start"], name: "place_start" },
        { keys: ["куда", "end"], name: "place_end" },
        { keys: ["дат"], name: "Date" },
        { keys: ["время", "time"], name: "Time" },
      ];
      let matched = false;
      for (const m of map) {
        if (m.keys.some((k) => text.includes(k))) {
          form.querySelector<HTMLInputElement>(`[name="${m.name}"]`)?.classList.add("!border-red-500");
          matched = true;
        }
      }
      if (!matched) {
        for (const n of REQUIRED) {
          const f = form.querySelector<HTMLInputElement>(`[name="${n}"]`);
          if (f && !f.value.trim()) f.classList.add("!border-red-500");
        }
      }
    };

    // Смена маршрута/параметров делает кэш цен неактуальным — сбрасываем его,
    // но НЕ трогаем при выборе самого тарифа.
    const ROUTE_FIELDS = ["place_start", "place_end", "Date", "Time", "count_peeple", "count_bags", "orderBabyChair", "orderBuster", "orderPet"];
    const onRouteChange = (e: Event) => {
      const name = (e.target as HTMLElement)?.getAttribute?.("name") || "";
      if (ROUTE_FIELDS.includes(name)) clearTariffPriceCache();
    };

    form.addEventListener("submit", onSubmitCapture, true);
    form.addEventListener("input", clearErr, true);
    form.addEventListener("input", onRouteChange, true);
    form.addEventListener("change", onRouteChange, true);
    // После успешной отправки хук чистит поля и шлёт это событие —
    // сбрасываем активный тариф, панель и оплату.
    const onReset = () => {
      setTariff(TARIFFS[0]);
      setPanel("main");
      setPay("transfer");
    };
    window.addEventListener("orderFormReset", onReset);

    return () => {
      window.alert = nativeAlert;
      form.removeEventListener("submit", onSubmitCapture, true);
      form.removeEventListener("input", clearErr, true);
      form.removeEventListener("input", onRouteChange, true);
      form.removeEventListener("change", onRouteChange, true);
      window.removeEventListener("orderFormReset", onReset);
    };
  }, []);

  // Синхронизируем выбранный способ оплаты со скрытыми чекбоксами,
  // которые читает штатный скрипт (CardPayCash / CardPayTransfer / CardPayNubmerCard).
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const map: Record<string, string> = {
      cash: "CardPayCash",
      transfer: "CardPayTransfer",
      account: "CardPayNubmerCard",
    };
    (["cash", "transfer", "account"] as const).forEach((k) => {
      const cb = form.querySelector<HTMLInputElement>(`[name="${map[k]}"]`);
      if (cb) cb.checked = pay === k;
    });
    const active = form.querySelector<HTMLInputElement>(`[name="${map[pay]}"]`);
    active?.dispatchEvent(new Event("change", { bubbles: true }));
  }, [pay]);

  useEffect(() => {
    if (prefillFrom || prefillTo || prefillComment) {
      const el = document.querySelector(".uc-tariffCalc");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [prefillFrom, prefillTo, prefillComment]);

  return {
    prefillFrom,
    prefillTo,
    prefillComment,
    formRef,
    tarifRef,
    isMobile,
    tariff,
    panel,
    setPanel,
    pay,
    setPay,
    geoLoading,
    detectLocation,
    pickTariff,
  };
}