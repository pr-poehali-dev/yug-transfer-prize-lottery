import { useState } from "react";
import Icon from "@/components/ui/icon";
import { Section, NAV_ITEMS, TICKER_ITEMS, RAFFLES } from "@/components/raffle-types";
import { RafflesSection, CabinetSection, HistorySection, ContactsSection } from "@/components/PageSections";
import { AuthModal } from "@/components/AuthModal";

export default function Index() {
  const [activeSection, setActiveSection] = useState<Section>("raffles");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const SECTION_COMPONENTS: Record<Section, JSX.Element> = {
    raffles: <RafflesSection />,
    cabinet: <CabinetSection />,
    history: <HistorySection />,
    contacts: <ContactsSection />,
  };

  const SECTION_TITLES: Record<Section, { title: string; subtitle: string }> = {
    raffles: { title: "Розыгрыши", subtitle: "Участвуй и выигрывай крутые призы" },
    cabinet: { title: "Личный кабинет", subtitle: "Управляй участиями и балансом" },
    history: { title: "История участий", subtitle: "Все твои ставки в одном месте" },
    contacts: { title: "Контакты", subtitle: "Мы всегда на связи" },
  };

  return (
    <div className="min-h-screen mesh-bg">
      {/* Ticker */}
      <div className="bg-gradient-to-r from-purple-900/60 via-pink-900/60 to-purple-900/60 border-b border-purple-500/20 py-2 overflow-hidden">
        <div className="flex gap-12 animate-ticker whitespace-nowrap">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i} className="text-sm text-purple-200 font-medium flex-shrink-0">
              {item}
              <span className="mx-6 text-purple-500">◆</span>
            </span>
          ))}
        </div>
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-50 glass border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveSection("raffles")}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center animate-pulse-glow">
              <span className="text-lg">🎰</span>
            </div>
            <div>
              <span className="font-oswald text-xl font-bold text-white tracking-wide">ЮГ</span>
              <span className="font-oswald text-xl font-bold grad-text tracking-wide"> ТРАНСФЕР</span>
            </div>
          </div>

          <nav className="hidden md:flex gap-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  activeSection === item.id
                    ? "grad-btn shadow-lg shadow-purple-500/20"
                    : "text-muted-foreground hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon name={item.icon as string} size={16} fallback="Circle" />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setAuthOpen(true)}
              className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl neon-border text-sm font-medium text-white hover:bg-white/5 transition-colors"
            >
              <Icon name="LogIn" size={16} />
              Войти
            </button>
            <button
              className="md:hidden p-2 text-muted-foreground hover:text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Icon name={mobileMenuOpen ? "X" : "Menu"} size={22} />
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/5 bg-background/95 backdrop-blur-xl">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => { setActiveSection(item.id); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-6 py-4 text-sm font-medium transition-colors ${
                  activeSection === item.id ? "text-purple-400 bg-purple-500/10" : "text-muted-foreground"
                }`}
              >
                <Icon name={item.icon as string} size={18} fallback="Circle" />
                {item.label}
              </button>
            ))}
            <button
              onClick={() => { setAuthOpen(true); setMobileMenuOpen(false); }}
              className="w-full flex items-center gap-3 px-6 py-4 text-sm font-medium text-purple-400 border-t border-white/5"
            >
              <Icon name="LogIn" size={18} />
              Войти / Регистрация
            </button>
          </div>
        )}
      </header>

      {/* Hero (only on raffles) */}
      {activeSection === "raffles" && (
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-pink-900/20 to-orange-900/20" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-20 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" />

          <div className="relative max-w-7xl mx-auto px-4 md:px-6 py-14 md:py-20">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass neon-border text-xs font-medium text-purple-300 mb-5 animate-fade-in-up">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {RAFFLES.filter(r => r.status === "active").length} активных розыгрыша прямо сейчас
              </div>

              <h1
                className="font-oswald text-5xl md:text-7xl font-bold leading-none mb-4 opacity-0-init animate-fade-in-up delay-100"
                style={{ animationFillMode: "forwards" }}
              >
                ТВОЙ ШАНС<br />
                <span className="grad-text">ИЗМЕНИТЬ</span><br />
                ВСЁ
              </h1>

              <p
                className="text-muted-foreground text-lg mb-8 opacity-0-init animate-fade-in-up delay-200"
                style={{ animationFillMode: "forwards" }}
              >
                Розыгрыши призов с честными правилами. Тысячи победителей ежемесячно.
              </p>

              <div
                className="flex flex-wrap gap-3 opacity-0-init animate-fade-in-up delay-300"
                style={{ animationFillMode: "forwards" }}
              >
                <button className="grad-btn rounded-2xl px-8 py-4 font-bold text-base font-golos flex items-center gap-2">
                  <Icon name="Zap" size={18} />
                  Участвовать сейчас
                </button>
                <button className="glass neon-border rounded-2xl px-8 py-4 font-semibold text-white text-base font-golos hover:bg-white/5 transition-colors">
                  Как это работает?
                </button>
              </div>

              <div
                className="flex flex-wrap gap-8 mt-10 opacity-0-init animate-fade-in-up delay-400"
                style={{ animationFillMode: "forwards" }}
              >
                {[
                  { value: "150 000+", label: "Участников" },
                  { value: "2 400+", label: "Победителей" },
                  { value: "850 млн ₽", label: "Призов роздано" },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="font-oswald text-2xl font-bold grad-text">{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        {activeSection !== "raffles" && (
          <div className="mb-8 opacity-0-init animate-fade-in-up" style={{ animationFillMode: "forwards" }}>
            <h2 className="font-oswald text-4xl font-bold text-white">
              {SECTION_TITLES[activeSection].title}
            </h2>
            <p className="text-muted-foreground mt-1">{SECTION_TITLES[activeSection].subtitle}</p>
          </div>
        )}

        {SECTION_COMPONENTS[activeSection]}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-oswald text-lg font-bold text-white">ЮГ</span>
            <span className="font-oswald text-lg font-bold grad-text"> ТРАНСФЕР</span>
          </div>
          <p className="text-xs text-muted-foreground">© 2026 ЮГ ТРАНСФЕР — Все права защищены</p>
          <div className="flex gap-4 items-center">
            {["Правила", "Конфиденциальность", "Поддержка"].map(l => (
              <button key={l} className="text-xs text-muted-foreground hover:text-white transition-colors">
                {l}
              </button>
            ))}
            <a
              href="/admin"
              className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            >
              Админ
            </a>
          </div>
        </div>
      </footer>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  );
}