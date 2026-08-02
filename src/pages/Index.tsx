import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import ContactWidget from "@/components/ContactWidget";
import FeaturesBar from "@/components/FeaturesBar";
import Icon from "@/components/ui/icon";
import useSEO from "@/hooks/useSEO";
import useTariffCalc, { applySelectedTariffFromCache, clearTariffPriceCache, syncOrderPriceField } from "@/hooks/useTariffCalc";
import { useIsMobile } from "@/hooks/use-mobile";

const BG = "https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/0ea8c632-dfa9-4e5c-8051-74474ecd91aa.jpg";
const TARIFFS = ["Срочный", "Стандарт", "Комфорт", "Минивэн", "Бизнес", "Доставка"];
const TARIFF_ICONS: Record<string, string> = {
  Срочный: "Zap",
  Стандарт: "Car",
  Комфорт: "CarFront",
  Минивэн: "Bus",
  Бизнес: "CarTaxiFront",
  Доставка: "Package",
};
const COUNTS = ["1", "2", "3", "4", "5", "6", "7", "8"];

const inputCls =
  "w-full bg-[#2a2a2a] border border-white/5 rounded-xl px-4 py-2.5 text-white placeholder-white/40 text-[15px] outline-none focus:border-amber-400/60 transition-colors [color-scheme:dark]";

// Тумблер-переключатель поверх скрытого чекбокса (name читает скрипт калькулятора).
function Toggle({ name, label }: { name: string; label: string }) {
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
function PayToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full flex items-center justify-between py-2.5 text-left">
      <span className="text-white text-[15px]">{label}</span>
      <span className={"relative w-11 h-6 rounded-full transition-colors shrink-0 " + (active ? "bg-amber-400/30" : "bg-white/10")}>
        <span className={"absolute top-1 w-4 h-4 rounded-full transition-all " + (active ? "left-6 bg-amber-400" : "left-1 bg-white/50")} />
      </span>
    </button>
  );
}

const Index = () => {
  useSEO({
    title: "Мой Трансфер — заказ такси и трансфера по Краснодарскому краю и Крыму 24/7",
    description:
      "Трансфер и такси по Краснодарскому краю, к морю и через Крымский мост. Фиксированная цена, иномарки комфорт и бизнес-класса, детские кресла, круглосуточно. Подача за 5 минут.",
  });

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

  // Штатный скрипт: подсказки, расчёт цены и отправка заявки.
  useTariffCalc(true);

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

  useEffect(() => {
    const ld = {
      "@context": "https://schema.org",
      "@type": "TaxiService",
      name: "Мой Трансфер",
      description:
        "Заказ трансфера и такси по Краснодарскому краю, к морю и в Крым через Крымский мост. Фиксированная цена, круглосуточно.",
      url: "https://moy-transfer.ru/",
      telephone: "+7 (978) 109-28-75",
      priceRange: "от 2000 ₽",
      image:
        "https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/59babb22-2f49-45ef-8194-86e9f5901762.jpg",
      areaServed: [
        { "@type": "State", name: "Краснодарский край" },
        { "@type": "Place", name: "Республика Крым" },
      ],
      availableChannel: {
        "@type": "ServiceChannel",
        servicePhone: { "@type": "ContactPoint", telephone: "+7 (978) 109-28-75", contactType: "reservations" },
        serviceUrl: "https://moy-transfer.ru/",
      },
      hoursAvailable: {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        opens: "00:00",
        closes: "23:59",
      },
      makesOffer: [
        "Трансфер в аэропорт",
        "Междугородний трансфер",
        "Трансфер к морю и на курорты",
        "Трансфер через Крымский мост",
        "Доставка посылок между городами",
      ].map((n) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: n } })),
    };
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.text = JSON.stringify(ld);
    document.head.appendChild(el);
    return () => {
      document.head.removeChild(el);
    };
  }, []);

  return (
    <div
      className="h-screen overflow-hidden bg-cover bg-center relative"
      style={{ backgroundImage: `url(${BG})` }}
    >
      {/* Карта маршрута (скрипт калькулятора рисует маршрут в #map) */}
      <div id="map" className="absolute inset-0 z-0" />
      <div className="absolute inset-0 bg-black/50 z-[1] pointer-events-none" />

      <SiteHeader />

      {/* МОБИЛЬНАЯ ВЕРСИЯ: нижняя шторка с панелями */}
      {isMobile && (
      <div className="uc-tariffCalc absolute z-10 inset-x-0 bottom-0">
        <div className="bg-[#141414] rounded-t-[28px] md:rounded-[28px] border-t md:border border-white/10 shadow-[0_-8px_40px_rgba(0,0,0,0.5)]">
          <form ref={formRef} className="flex flex-col">
            {/* «ручка» шторки */}
            <div className="pt-2 pb-0.5 flex justify-center md:hidden">
              <span className="w-11 h-1.5 rounded-full bg-white/20" />
            </div>

            {/* Заголовок доп. панелей с кнопкой «Назад» */}
            {panel !== "main" && (
              <button
                type="button"
                onClick={() => setPanel("main")}
                className="flex items-center gap-2 px-6 pt-3 pb-1 text-white text-base font-semibold"
              >
                <Icon name="ArrowLeft" size={20} />
                Назад
              </button>
            )}

            {/* ПАНЕЛЬ: ГЛАВНАЯ */}
            <div className={"px-5 pt-2 pb-1 space-y-2 " + (panel === "main" ? "" : "hidden")}>
              <div className="relative">
                <input name="place_start" defaultValue={prefillFrom} placeholder="Откуда?" autoComplete="off" className={inputCls + " pr-12"} />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-amber-400 flex items-center justify-center">
                  <Icon name="MapPin" size={16} className="text-amber-400" />
                </span>
              </div>
              <input name="place_end" defaultValue={prefillTo} placeholder="Куда?" autoComplete="off" className={inputCls} />

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-white/50 text-[11px] font-medium mb-0.5 ml-1">Дата поездки</label>
                  <input name="Date" type="date" className={inputCls} />
                </div>
                <div>
                  <label className="block text-white/50 text-[11px] font-medium mb-0.5 ml-1">Во сколько?</label>
                  <input name="Time" type="time" className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <input name="name" placeholder="Ваше имя" className={inputCls} />
                <input name="Phone" placeholder="Номер телефона" type="tel" className={inputCls} />
              </div>

              {/* Скрытый select — его читает скрипт калькулятора */}
              <select ref={tarifRef} name="tarif" defaultValue={TARIFFS[0]} className="hidden" aria-hidden>
                {TARIFFS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>

              <div className="no-scrollbar flex gap-2 overflow-x-auto -mx-1 px-1 pt-1">
                {TARIFFS.map((t) => {
                  const active = tariff === t;
                  return (
                    <button
                      type="button"
                      key={t}
                      onClick={() => pickTariff(t)}
                      className={
                        "calc__form__tarif__item shrink-0 w-[84px] flex flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-2 transition-colors " +
                        (active
                          ? "is-active border-amber-400 bg-amber-400/10"
                          : "border-white/10 bg-black/40 hover:border-amber-400/40")
                      }
                    >
                      <Icon
                        name={TARIFF_ICONS[t] || "Car"}
                        size={22}
                        className={active ? "text-amber-400" : "text-white/60"}
                      />
                      <span className={"calc__form__tarif__item__title text-xs font-medium leading-tight " + (active ? "text-white" : "text-white/70")}>
                        {t}
                      </span>
                      <span
                        ref={(el) => {
                          if (el && !el.textContent) el.textContent = "—";
                        }}
                        className={"calc__form__tarif__item__price text-[15px] font-extrabold leading-tight whitespace-nowrap " + (active ? "text-amber-400" : "text-white/70")}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ПАНЕЛЬ: ДОП. ОПЦИИ */}
            <div className={"px-6 pt-1 pb-2 " + (panel === "extra" ? "" : "hidden")}>
              <Toggle name="orderBabyChair" label="Детское кресло" />
              <div className="h-px bg-white/10" />
              <Toggle name="orderPet" label="С домашним животным" />
              <div className="h-px bg-white/10" />
              <Toggle name="orderBuster" label="Бустер" />

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-white/50 text-[11px] font-medium mb-0.5 ml-1">Количество человек</label>
                  <select name="count_peeple" defaultValue="1" className={inputCls}>
                    {COUNTS.map((c) => <option key={c} value={c} className="bg-[#1a1a1a]">{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-white/50 text-[11px] font-medium mb-0.5 ml-1">Количество багажа</label>
                  <select name="count_bags" defaultValue="1" className={inputCls}>
                    {["0", ...COUNTS].map((c) => <option key={c} value={c} className="bg-[#1a1a1a]">{c}</option>)}
                  </select>
                </div>
              </div>

              <textarea name="comment" defaultValue={prefillComment} placeholder="Комментарий водителю" rows={2} className={inputCls + " mt-2 resize-none"} />
            </div>

            {/* ПАНЕЛЬ: ОПЛАТА */}
            <div className={"px-6 pt-1 pb-2 " + (panel === "pay" ? "" : "hidden")}>
              <PayToggle label="Наличные" active={pay === "cash"} onClick={() => setPay("cash")} />
              <div className="h-px bg-white/10" />
              <PayToggle label="Перевод" active={pay === "transfer"} onClick={() => setPay("transfer")} />
              <div className="h-px bg-white/10" />
              <PayToggle label="По номеру счёта" active={pay === "account"} onClick={() => setPay("account")} />
            </div>

            {/* Скрытые поля, которые читает скрипт */}
            <input type="hidden" name="order_price" defaultValue="" />
            <input type="checkbox" name="CardPayCash" className="hidden" aria-hidden readOnly />
            <input type="checkbox" name="CardPayTransfer" className="hidden" aria-hidden defaultChecked readOnly />
            <input type="checkbox" name="CardPayNubmerCard" className="hidden" aria-hidden readOnly />

            {/* Нижняя панель действий */}
            <div className="flex items-center gap-3 px-5 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-5">
              <button
                type="button"
                onClick={() => setPanel(panel === "pay" ? "main" : "pay")}
                aria-label="Способ оплаты"
                className={"shrink-0 w-12 h-12 rounded-full flex items-center justify-center border transition-colors " + (panel === "pay" ? "border-amber-400 text-amber-400" : "border-amber-400/50 text-amber-400/80 hover:border-amber-400")}
              >
                <Icon name="Wallet" size={22} />
              </button>

              <button
                type="submit"
                className="flex-1 h-12 flex items-center justify-center text-lg font-bold rounded-full bg-[#d1d13a] hover:bg-[#dede4a] text-black transition-colors"
              >
                Отправить
              </button>

              <button
                type="button"
                onClick={() => setPanel(panel === "extra" ? "main" : "extra")}
                aria-label="Дополнительно"
                className={"shrink-0 w-12 h-12 rounded-full flex items-center justify-center border transition-colors " + (panel === "extra" ? "border-amber-400 text-amber-400" : "border-amber-400/50 text-amber-400/80 hover:border-amber-400")}
              >
                <Icon name="SlidersHorizontal" size={22} />
              </button>
            </div>
          </form>
        </div>
      </div>
      )}

      {/* ДЕСКТОПНАЯ ВЕРСИЯ: прежняя форма «Оставить заявку» */}
      {!isMobile && (
      <div className="relative z-10 w-full max-w-lg px-5 pt-3 pb-0 h-auto overflow-visible block absolute bottom-4 left-0">
        <div className="text-center mb-2">
          <h1 className="text-2xl font-bold text-white">Мой Трансфер</h1>
        </div>
        <div className="uc-tariffCalc bg-[#1a1a1a]/95 backdrop-blur rounded-2xl border border-white/10 shadow-2xl p-5 block">
          <form ref={formRef} className="block">
            <h2 className="text-lg font-bold text-amber-400 text-center mb-2">Оставить заявку</h2>
            <div className="space-y-2">
              <input name="place_start" defaultValue={prefillFrom} placeholder="Откуда вас забрать?" autoComplete="off" className={inputCls} />
              <input name="place_end" defaultValue={prefillTo} placeholder="Куда довезти?" autoComplete="off" className={inputCls} />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/80 text-xs font-medium mb-1">Дата поездки</label>
                  <input name="Date" type="date" className={inputCls} />
                </div>
                <div>
                  <label className="block text-white/80 text-xs font-medium mb-1">Время</label>
                  <input name="Time" type="time" className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/80 text-xs font-medium mb-1">Кол-во человек</label>
                  <select name="count_peeple" defaultValue="1" className={inputCls}>
                    {COUNTS.map((c) => <option key={c} value={c} className="bg-[#1a1a1a]">{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-white/80 text-xs font-medium mb-1">Кол-во багажа</label>
                  <select name="count_bags" defaultValue="1" className={inputCls}>
                    {["0", ...COUNTS].map((c) => <option key={c} value={c} className="bg-[#1a1a1a]">{c}</option>)}
                  </select>
                </div>
              </div>

              <select ref={tarifRef} name="tarif" defaultValue={TARIFFS[0]} className="hidden" aria-hidden>
                {TARIFFS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>

              <div>
                <label className="block text-white/80 text-xs font-medium mb-1">Выберите класс авто</label>
                <div className="no-scrollbar flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
                  {TARIFFS.map((t) => {
                    const active = tariff === t;
                    return (
                      <button
                        type="button"
                        key={t}
                        onClick={() => pickTariff(t)}
                        className={
                          "calc__form__tarif__item shrink-0 w-[76px] flex flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-2 transition-colors " +
                          (active
                            ? "is-active border-amber-500 bg-amber-500/15"
                            : "border-white/10 bg-black/30 hover:border-amber-500/40")
                        }
                      >
                        <Icon
                          name={TARIFF_ICONS[t] || "Car"}
                          size={20}
                          className={active ? "text-amber-400" : "text-white/70"}
                        />
                        <span className={"calc__form__tarif__item__title text-[10px] leading-tight " + (active ? "text-white" : "text-white/70")}>
                          {t}
                        </span>
                        <span
                          ref={(el) => {
                            if (el && !el.textContent) el.textContent = "—";
                          }}
                          className="calc__form__tarif__item__price text-sm font-extrabold leading-tight whitespace-nowrap text-amber-400"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between gap-1.5 pt-2">
                <label className="flex items-center gap-1.5 text-white/90 text-sm cursor-pointer whitespace-nowrap">
                  <input type="checkbox" name="orderBabyChair" className="w-4 h-4 accent-amber-500 shrink-0" />
                  Дет. кресло
                </label>
                <label className="flex items-center gap-1.5 text-white/90 text-sm cursor-pointer whitespace-nowrap">
                  <input type="checkbox" name="orderBuster" className="w-4 h-4 accent-amber-500 shrink-0" />
                  Бустер
                </label>
                <label className="flex items-center gap-1.5 text-white/90 text-sm cursor-pointer whitespace-nowrap">
                  <input type="checkbox" name="orderPet" className="w-4 h-4 accent-amber-500 shrink-0" />
                  Животные
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input name="name" placeholder="Как вас зовут" className={inputCls} />
                <input name="Phone" placeholder="+7 (987) 777-77-77" type="tel" className={inputCls} />
              </div>

              <textarea name="comment" defaultValue={prefillComment} placeholder="Комментарий (необязательно)" rows={2} className={inputCls} />

              <input type="hidden" name="order_price" defaultValue="" />
              <input type="checkbox" name="CardPayCash" defaultChecked className="hidden" aria-hidden />

              <button
                type="submit"
                className="w-full mt-3 h-14 min-h-14 max-h-14 shrink-0 flex items-center justify-center gap-2 leading-none text-lg font-bold rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white transition-colors [&_img]:h-6 [&_img]:w-6 [&_svg]:h-6 [&_svg]:w-6 overflow-hidden"
              >
                Заказать
              </button>
            </div>
          </form>
        </div>
      </div>
      )}

      <ContactWidget />
      <FeaturesBar />
    </div>
  );
};

export default Index;