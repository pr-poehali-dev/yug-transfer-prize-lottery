import { useState, lazy, Suspense } from "react";
import { Section, SiteHeader, SiteFooter } from "@/components/index/shared";
import { HomeSection } from "@/components/index/HomeSection";
import { ServicesSection } from "@/components/index/ServicesSection";
import { BotSection } from "@/components/index/BotSection";
import { DriversSection } from "@/components/index/DriversSection";

const ContactsSection = lazy(() =>
  import("@/components/sections/ContactsSection").then((m) => ({ default: m.ContactsSection }))
);

export default function Index() {
  const [active, setActive] = useState<Section>("home");
  const [menuOpen, setMenuOpen] = useState(false);

  const go = (s: Section) => {
    setActive(s);
    setMenuOpen(false);
  };

  return (
    <div className="min-h-screen mesh-bg">
      <SiteHeader active={active} menuOpen={menuOpen} setMenuOpen={setMenuOpen} go={go} />

      <main className={`max-w-7xl mx-auto px-4 md:px-6 ${active === "home" ? "py-3 md:py-4" : "py-8 md:py-12"}`}>
        {active === "home" && <HomeSection onNav={go} />}
        {active === "services" && <ServicesSection />}
        {active === "bot" && <BotSection />}
        {active === "drivers" && <DriversSection />}
        {active === "contacts" && (
          <Suspense fallback={<div className="text-center text-muted-foreground py-20">Загрузка...</div>}>
            <ContactsSection />
          </Suspense>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}