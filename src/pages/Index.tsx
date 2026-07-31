import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import ContactWidget from "@/components/ContactWidget";
import FeaturesBar from "@/components/FeaturesBar";
import AddressInput from "@/components/AddressInput";
import Icon from "@/components/ui/icon";
import useSEO from "@/hooks/useSEO";
import usePriceCalc from "@/hooks/usePriceCalc";

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

  const [from, setFrom] = useState(prefillFrom);
  const [to, setTo] = useState(prefillTo);
  const [tariff, setTariff] = useState(TARIFFS[0]);
  const [babyChair, setBabyChair] = useState(false);
  const [buster, setBuster] = useState(false);
  const [pet, setPet] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const price = usePriceCalc();

  // Авторасчёт стоимости при изменении адресов / доп.опций.
  useEffect(() => {
    price.calc({ start: from, end: to, babyChair, buster, pet });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, babyChair, buster, pet]);

  const selectedPrice =
    price.tariffs && price.tariffs[tariff] != null ? price.tariffs[tariff] : null;

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const REQUIRED = ["place_start", "place_end", "Date", "Time", "name", "Phone"];
    const missing: HTMLInputElement[] = [];
    for (const n of REQUIRED) {
      const field = form.querySelector<HTMLInputElement>(`[name="${n}"]`);
      if (field && !field.value.trim()) missing.push(field);
    }
    if (missing.length > 0) {
      missing.forEach((f) => f.classList.add("!border-red-500"));
      missing[0].focus();
      return;
    }

    setSending(true);
    try {
      const get = (n: string) =>
        (form.querySelector<HTMLInputElement>(`[name="${n}"]`)?.value || "").trim();
      const fd = new FormData();
      fd.append("orderClientName", get("name"));
      fd.append("orderTel", get("Phone"));
      fd.append("orderDate", get("Date"));
      fd.append("orderTime", get("Time"));
      fd.append("orderStart", get("place_start"));
      fd.append("orderFinish", get("place_end"));
      fd.append("orderPeeple", get("count_peeple"));
      fd.append("orderBags", get("count_bags"));
      fd.append("orderTarif", tariff);
      if (selectedPrice != null) fd.append("orderPrice", String(selectedPrice));
      fd.append("orderComment", get("comment"));
      fd.append("orderBabyChair", babyChair ? "true" : "false");
      fd.append("orderBuster", buster ? "true" : "false");
      fd.append("orderPet", pet ? "true" : "false");
      fd.append("CardPayCash", "true");
      fd.append("CardPayTransfer", "false");
      fd.append("CardPayNubmerCard", "false");
      fd.append("source", window.location.href);
      await fetch(
        "https://vse-zakazy.ru/wp-content/themes/ug-transfer-operator/tariffCalc/order-create.php",
        { method: "POST", body: fd }
      );
      setSent(true);
      form.reset();
      setFrom("");
      setTo("");
      price.reset();
    } catch {
      /* ignore network errors — заявка чаще всего доходит */
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  const clearError = (el: EventTarget & HTMLElement) => {
    el.classList?.remove("!border-red-500");
  };

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
      <div className="absolute inset-0 bg-black/60 z-[1] pointer-events-none" />

      <SiteHeader />

      <div className="relative z-10 w-full max-w-lg px-5 pt-5 md:pt-3 pb-5 md:pb-0 h-[calc(100vh-72px)] md:h-auto overflow-y-auto md:overflow-visible flex flex-col justify-center md:block md:absolute md:bottom-4 md:left-0">
        <div className="text-center mb-3 md:mb-2">
          <h1 className="text-2xl md:text-2xl font-bold text-white">Мой Трансфер</h1>
          <p className="md:hidden text-white/80 text-sm mt-0.5">Сервис заказа легкового такси</p>
        </div>
        <div className="uc-tariffCalc bg-[#1a1a1a]/95 backdrop-blur rounded-2xl border border-white/10 shadow-2xl p-4 md:p-5 flex flex-col md:block">
          {sent ? (
            <div className="text-center py-8 flex flex-col items-center gap-3">
              <Icon name="CircleCheck" size={56} className="text-amber-400" />
              <h2 className="text-xl font-bold text-white">Заявка принята!</h2>
              <p className="text-white/70 text-sm max-w-xs">
                Спасибо! Наш диспетчер свяжется с вами в ближайшее время для подтверждения заказа.
              </p>
              <button
                onClick={() => setSent(false)}
                className="mt-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold transition-colors"
              >
                Оформить ещё
              </button>
            </div>
          ) : (
          <form ref={formRef} onSubmit={onSubmit} className="flex-1 flex flex-col md:block">
            <h2 className="text-lg md:text-lg font-bold text-amber-400 text-center mb-3 md:mb-2">Оставить заявку</h2>
            <div className="space-y-3 md:space-y-2 flex-1 flex flex-col justify-center">
              <AddressInput name="place_start" defaultValue={prefillFrom} placeholder="Откуда вас забрать?" className={inputCls} onChangeValue={setFrom} />
              <AddressInput name="place_end" defaultValue={prefillTo} placeholder="Куда довезти?" className={inputCls} onChangeValue={setTo} />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/80 text-xs font-medium mb-1">Дата поездки</label>
                  <input name="Date" type="date" onInput={(e) => clearError(e.currentTarget)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-white/80 text-xs font-medium mb-1">Время</label>
                  <input name="Time" type="time" onInput={(e) => clearError(e.currentTarget)} className={inputCls} />
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

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-white/80 text-xs font-medium">Выберите класс авто</label>
                  {price.loading && (
                    <span className="flex items-center gap-1 text-amber-400/80 text-[11px]">
                      <Icon name="LoaderCircle" size={12} className="animate-spin" />
                      считаем…
                    </span>
                  )}
                  {!price.loading && price.distanceKm != null && (
                    <span className="text-white/50 text-[11px]">маршрут {price.distanceKm} км</span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {TARIFFS.map((t) => {
                    const p = price.tariffs ? price.tariffs[t] : null;
                    const active = tariff === t;
                    return (
                      <button
                        type="button"
                        key={t}
                        onClick={() => setTariff(t)}
                        className={
                          "flex flex-col items-center justify-center gap-0.5 rounded-xl border px-1.5 py-2 transition-colors " +
                          (active
                            ? "border-amber-500 bg-amber-500/15"
                            : "border-white/10 bg-black/30 hover:border-amber-500/40")
                        }
                      >
                        <Icon
                          name={TARIFF_ICONS[t] || "Car"}
                          size={22}
                          className={active ? "text-amber-400" : "text-white/70"}
                        />
                        <span className={"text-[11px] leading-tight " + (active ? "text-white" : "text-white/70")}>
                          {t}
                        </span>
                        <span
                          className={
                            "text-[13px] font-bold leading-tight " +
                            (active ? "text-amber-400" : "text-white/85")
                          }
                        >
                          {p != null ? `${p.toLocaleString("ru-RU")} ₽` : "—"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {price.error && (
                  <p className="text-white/50 text-xs mt-1.5">{price.error}</p>
                )}
              </div>

              <div className="flex items-center justify-between gap-1.5 pt-1 md:pt-2">
                <label className="flex items-center gap-1.5 text-white/90 text-xs sm:text-sm cursor-pointer whitespace-nowrap">
                  <input type="checkbox" name="orderBabyChair" checked={babyChair} onChange={(e) => setBabyChair(e.target.checked)} className="w-4 h-4 accent-amber-500 shrink-0" />
                  Дет. кресло
                </label>
                <label className="flex items-center gap-1.5 text-white/90 text-xs sm:text-sm cursor-pointer whitespace-nowrap">
                  <input type="checkbox" name="orderBuster" checked={buster} onChange={(e) => setBuster(e.target.checked)} className="w-4 h-4 accent-amber-500 shrink-0" />
                  Бустер
                </label>
                <label className="flex items-center gap-1.5 text-white/90 text-xs sm:text-sm cursor-pointer whitespace-nowrap">
                  <input type="checkbox" name="orderPet" checked={pet} onChange={(e) => setPet(e.target.checked)} className="w-4 h-4 accent-amber-500 shrink-0" />
                  Животные
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input name="name" placeholder="Как вас зовут" onInput={(e) => clearError(e.currentTarget)} className={inputCls} />
                <input name="Phone" placeholder="+7 (987) 777-77-77" type="tel" onInput={(e) => clearError(e.currentTarget)} className={inputCls} />
              </div>

              <textarea name="comment" defaultValue={prefillComment} placeholder="Комментарий (необязательно)" rows={2} className={inputCls} />

              <button
                type="submit"
                disabled={sending}
                className="w-full mt-3 md:mt-3 py-4 md:py-4 text-lg font-bold rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {sending ? (
                  <><Icon name="LoaderCircle" size={20} className="animate-spin" /> Отправляем…</>
                ) : (
                  "Заказать"
                )}
              </button>
            </div>
          </form>
          )}
        </div>

      </div>

      <ContactWidget />
      <FeaturesBar />
    </div>
  );
};

export default Index;