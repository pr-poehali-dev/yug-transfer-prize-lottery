import { useEffect } from "react";
import SiteHeader from "@/components/SiteHeader";
import ContactWidget from "@/components/ContactWidget";
import FeaturesBar from "@/components/FeaturesBar";
import useSEO from "@/hooks/useSEO";
import { BG, useOrderForm } from "@/components/order/orderFormShared";
import MobileOrderForm from "@/components/order/MobileOrderForm";
import DesktopOrderForm from "@/components/order/DesktopOrderForm";

const Index = () => {
  useSEO({
    title: "Мой Трансфер — заказ такси и трансфера по Краснодарскому краю и Крыму 24/7",
    description:
      "Трансфер и такси по Краснодарскому краю, к морю и через Крымский мост. Фиксированная цена, иномарки комфорт и бизнес-класса, детские кресла, круглосуточно. Подача за 5 минут.",
  });

  const state = useOrderForm();
  const { isMobile } = state;

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
      className="h-screen [height:100dvh] overflow-hidden bg-cover bg-center relative"
      style={{ backgroundImage: `url(${BG})` }}
    >
      {/* Карта маршрута (скрипт калькулятора рисует маршрут в #map).
          На мобильном карта занимает ТОЛЬКО верхнюю зону экрана — тогда маршрут
          вписывается в неё и центрируется сам, не уходя под форму.
          На десктопе карта — на весь экран (форма сбоку). */}
      <div
        id="map"
        className={
          isMobile
            ? "absolute inset-x-0 top-0 h-[56dvh] z-0"
            : "absolute inset-0 z-0"
        }
      />
      <div
        className={
          isMobile
            ? "absolute inset-x-0 top-0 h-[56dvh] bg-black/40 z-[1] pointer-events-none"
            : "absolute inset-0 bg-black/50 z-[1] pointer-events-none"
        }
      />

      <SiteHeader />

      {isMobile && <MobileOrderForm state={state} />}
      {!isMobile && <DesktopOrderForm state={state} />}

      <ContactWidget />
      <FeaturesBar />
    </div>
  );
};

export default Index;