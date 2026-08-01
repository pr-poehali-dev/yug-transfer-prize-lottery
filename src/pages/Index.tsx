import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import ContactWidget from "@/components/ContactWidget";
import FeaturesBar from "@/components/FeaturesBar";
import Icon from "@/components/ui/icon";
import useSEO from "@/hooks/useSEO";
import useTariffCalc from "@/hooks/useTariffCalc";

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
  "w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/40 text-sm outline-none focus:border-amber-500/60 transition-colors [color-scheme:dark]";

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

  const [tariff, setTariff] = useState(TARIFFS[0]);

  // Штатный скрипт: подсказки, расчёт цены и отправка заявки.
  useTariffCalc(true);

  // Клик по карточке тарифа: меняем скрытый select[name=tarif] и триггерим
  // событие change, чтобы скрипт калькулятора пересчитал стоимость.
  const pickTariff = (t: string) => {
    setTariff(t);
    const sel = tarifRef.current;
    if (sel) {
      sel.value = t;
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
      }
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

    form.addEventListener("submit", onSubmitCapture, true);
    form.addEventListener("input", clearErr, true);
    return () => {
      window.alert = nativeAlert;
      form.removeEventListener("submit", onSubmitCapture, true);
      form.removeEventListener("input", clearErr, true);
    };
  }, []);

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

      <div className="relative z-10 w-full max-w-lg px-5 pt-5 md:pt-3 pb-5 md:pb-0 h-[calc(100vh-72px)] md:h-auto overflow-y-auto md:overflow-visible flex flex-col justify-center md:block md:absolute md:bottom-4 md:left-0">
        <div className="text-center mb-3 md:mb-2">
          <h1 className="text-2xl md:text-2xl font-bold text-white">Мой Трансфер</h1>
          <p className="md:hidden text-white/80 text-sm mt-0.5">Сервис заказа легкового такси</p>
        </div>
        <div className="uc-tariffCalc bg-[#1a1a1a]/95 backdrop-blur rounded-2xl border border-white/10 shadow-2xl p-4 md:p-5 flex flex-col md:block">
          <form ref={formRef} className="flex-1 flex flex-col md:block">
            <h2 className="text-lg md:text-lg font-bold text-amber-400 text-center mb-3 md:mb-2">Оставить заявку</h2>
            <div className="space-y-3 md:space-y-2 flex-1 flex flex-col justify-center">
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

              {/* Скрытый select — его читает скрипт калькулятора */}
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
                            ? "border-amber-500 bg-amber-500/15"
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
                          className={
                            "calc__form__tarif__item__price text-[12px] font-bold leading-tight whitespace-nowrap " +
                            (active ? "text-amber-400" : "text-white/85")
                          }
                        >
                          —
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between gap-1.5 pt-1 md:pt-2">
                <label className="flex items-center gap-1.5 text-white/90 text-xs sm:text-sm cursor-pointer whitespace-nowrap">
                  <input type="checkbox" name="orderBabyChair" className="w-4 h-4 accent-amber-500 shrink-0" />
                  Дет. кресло
                </label>
                <label className="flex items-center gap-1.5 text-white/90 text-xs sm:text-sm cursor-pointer whitespace-nowrap">
                  <input type="checkbox" name="orderBuster" className="w-4 h-4 accent-amber-500 shrink-0" />
                  Бустер
                </label>
                <label className="flex items-center gap-1.5 text-white/90 text-xs sm:text-sm cursor-pointer whitespace-nowrap">
                  <input type="checkbox" name="orderPet" className="w-4 h-4 accent-amber-500 shrink-0" />
                  Животные
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input name="name" placeholder="Как вас зовут" className={inputCls} />
                <input name="Phone" placeholder="+7 (987) 777-77-77" type="tel" className={inputCls} />
              </div>

              <textarea name="comment" defaultValue={prefillComment} placeholder="Комментарий (необязательно)" rows={2} className={inputCls} />

              <input type="hidden" name="order_price" value="" />
              <input type="checkbox" name="CardPayCash" defaultChecked className="hidden" aria-hidden />

              <button
                type="submit"
                className="w-full mt-3 md:mt-3 h-14 min-h-14 max-h-14 shrink-0 flex items-center justify-center gap-2 leading-none text-lg font-bold rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white transition-colors [&_img]:h-6 [&_img]:w-6 [&_svg]:h-6 [&_svg]:w-6 overflow-hidden"
              >
                Заказать
              </button>
            </div>
          </form>
        </div>

      </div>

      <ContactWidget />
      <FeaturesBar />
    </div>
  );
};

export default Index;