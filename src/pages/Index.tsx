import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import ContactWidget from "@/components/ContactWidget";
import FeaturesBar from "@/components/FeaturesBar";
import useSEO from "@/hooks/useSEO";
import useTariffCalc from "@/hooks/useTariffCalc";

const BG = "https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/0ea8c632-dfa9-4e5c-8051-74474ecd91aa.jpg";
const TARIFFS = ["Срочный", "Стандарт", "Комфорт", "Минивэн", "Бизнес", "Доставка"];
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

  useTariffCalc(true);

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
      <div id="map" aria-hidden="true" className="absolute inset-0 z-0" />
      <div className="absolute inset-0 bg-black/60 z-[1] pointer-events-none" />

      <SiteHeader />

      <div className="relative z-10 w-full max-w-lg px-5 pt-5 md:pt-3 pb-5 md:pb-0 h-[calc(100vh-72px)] md:h-auto overflow-y-auto md:overflow-visible flex flex-col justify-center md:block md:absolute md:bottom-4 md:left-0">
        <div className="text-center mb-3 md:mb-2">
          <h1 className="text-2xl md:text-2xl font-bold text-white">Мой Трансфер</h1>
          <p className="md:hidden text-white/80 text-sm mt-0.5">Сервис заказа легкового такси</p>
        </div>
        <div className="uc-tariffCalc bg-[#1a1a1a]/95 backdrop-blur rounded-2xl border border-white/10 shadow-2xl p-4 md:p-5 flex flex-col md:block">
          <form className="flex-1 flex flex-col md:block">
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

              <div>
                <label className="block text-white/80 text-xs font-medium mb-1">Выберите тариф</label>
                <select name="tarif" defaultValue="Срочный" className={inputCls}>
                  {TARIFFS.map((t) => <option key={t} value={t} className="bg-[#1a1a1a]">{t}</option>)}
                </select>
              </div>

              <div className="flex items-center justify-between gap-1.5 pt-1 md:pt-2">
                {[
                  { name: "orderBabyChair", label: "Дет. кресло" },
                  { name: "orderBuster", label: "Бустер" },
                  { name: "orderPet", label: "Животные" },
                ].map((c) => (
                  <label key={c.name} className="flex items-center gap-1.5 text-white/90 text-xs sm:text-sm cursor-pointer whitespace-nowrap">
                    <input type="checkbox" name={c.name} className="w-4 h-4 accent-amber-500 shrink-0" />
                    {c.label}
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input name="name" placeholder="Как вас зовут" className={inputCls} />
                <input name="Phone" placeholder="+7 (987) 777-77-77" type="tel" className={inputCls} />
              </div>

              <textarea name="comment" defaultValue={prefillComment} placeholder="Комментарий (необязательно)" rows={2} className={inputCls} />

              <input type="hidden" name="order_price" value="" />

              <button
                type="submit"
                className="w-full mt-3 md:mt-3 py-4 md:py-4 text-lg font-bold rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white transition-colors"
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