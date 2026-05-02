import Icon from "@/components/ui/icon";

export type Section = "home" | "services" | "bot" | "drivers" | "contacts";

export const NAV: { id: Section; label: string; icon: string }[] = [
  { id: "home", label: "Главная", icon: "Rocket" },
  { id: "services", label: "Услуги", icon: "Car" },
  { id: "drivers", label: "Водителям", icon: "Briefcase" },
  { id: "contacts", label: "Контакты", icon: "Phone" },
];

export function SectionHeader({ title, subtitle, icon }: { title: string; subtitle: string; icon: string }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
          <Icon name={icon} size={20} className="text-white" fallback="Circle" />
        </div>
        <h2 className="font-oswald text-3xl md:text-4xl font-bold text-white">{title}</h2>
      </div>
      <p className="text-muted-foreground ml-13 pl-1">{subtitle}</p>
    </div>
  );
}

export function SiteHeader({
  active,
  menuOpen,
  setMenuOpen,
  go,
}: {
  active: Section;
  menuOpen: boolean;
  setMenuOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  go: (s: Section) => void;
}) {
  return (
    <header className="glass border-b border-white/5 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between h-16">
        <button onClick={() => go("home")} className="flex items-center gap-3">
          <img
            src="https://cdn.poehali.dev/files/67b1710e-13db-49da-a319-264e54d63c57.png"
            alt="ЮГ ТРАНСФЕР"
            className="h-9 md:h-10 w-auto drop-shadow-[0_0_12px_rgba(255,140,40,0.35)]"
          />
          <p className="text-[10px] text-muted-foreground hidden sm:block max-w-[140px] leading-tight">
            космические трансферы юга
          </p>
        </button>

        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => go(n.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                active === n.id
                  ? "grad-btn shadow-lg"
                  : "text-muted-foreground hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon name={n.icon} size={16} fallback="Circle" />
              {n.label}
            </button>
          ))}
        </nav>

        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="md:hidden p-2 rounded-xl border border-white/10 text-white"
        >
          <Icon name={menuOpen ? "X" : "Menu"} size={20} />
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-white/5 px-4 py-3 flex flex-col gap-1">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => go(n.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                active === n.id
                  ? "grad-btn shadow-lg"
                  : "text-muted-foreground hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon name={n.icon} size={17} fallback="Circle" />
              {n.label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}

export function SiteFooter({ go }: { go?: (s: Section) => void }) {
  return (
    <footer className="border-t border-white/5 mt-12 bg-black/30 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-8">
          {/* Бренд */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <img
                src="https://cdn.poehali.dev/files/67b1710e-13db-49da-a319-264e54d63c57.png"
                alt="ЮГ ТРАНСФЕР"
                className="h-9 w-auto drop-shadow-[0_0_12px_rgba(255,140,40,0.35)]"
              />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Космические трансферы юга России. Аэропорты, межгород, фиксированная цена 24/7.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <a
                href="https://t.me/ug_transfer_online"
                target="_blank"
                rel="noreferrer"
                className="w-9 h-9 rounded-full bg-white/5 border border-white/10 hover:border-cyan-400/50 hover:text-cyan-300 flex items-center justify-center text-white/70 transition-colors"
                aria-label="Telegram"
              >
                <Icon name="Send" size={15} />
              </a>
              <a
                href="https://wa.me/79843348724"
                target="_blank"
                rel="noreferrer"
                className="w-9 h-9 rounded-full bg-white/5 border border-white/10 hover:border-green-400/50 hover:text-green-300 flex items-center justify-center text-white/70 transition-colors"
                aria-label="WhatsApp"
              >
                <Icon name="MessageCircle" size={15} />
              </a>
              <a
                href="tel:+79180295672"
                className="w-9 h-9 rounded-full bg-white/5 border border-white/10 hover:border-purple-400/50 hover:text-purple-300 flex items-center justify-center text-white/70 transition-colors"
                aria-label="Позвонить"
              >
                <Icon name="Phone" size={15} />
              </a>
            </div>
          </div>

          {/* Навигация */}
          <div>
            <p className="text-white font-semibold text-sm mb-3">Разделы</p>
            <ul className="space-y-2">
              {NAV.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => go?.(n.id)}
                    className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1.5"
                  >
                    <Icon name={n.icon} size={12} fallback="Circle" />
                    {n.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Контакты */}
          <div>
            <p className="text-white font-semibold text-sm mb-3">Контакты</p>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <a href="tel:+79180295672" className="flex items-center gap-2 hover:text-white transition-colors">
                  <Icon name="Phone" size={12} />
                  +7 (918) 029-56-72
                </a>
              </li>
              <li>
                <a href="mailto:help@ug-transfer.com" className="flex items-center gap-2 hover:text-white transition-colors">
                  <Icon name="Mail" size={12} />
                  help@ug-transfer.com
                </a>
              </li>
              <li>
                <a
                  href="https://t.me/ug_transfer_online"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 hover:text-white transition-colors"
                >
                  <Icon name="Send" size={12} />
                  @ug_transfer_online
                </a>
              </li>
            </ul>
          </div>

          {/* Реквизиты */}
          <div>
            <p className="text-white font-semibold text-sm mb-3">Реквизиты</p>
            <ul className="space-y-1.5 text-[11px] text-muted-foreground leading-snug">
              <li>
                <span className="text-white/40 block">Наименование</span>
                ИП Хоменко Владимир Владимирович
              </li>
              <li>
                <span className="text-white/40 block">ИНН</span>
                910238307053
              </li>
              <li>
                <span className="text-white/40 block">ОГРНИП</span>
                322911200095120
              </li>
              <li>
                <span className="text-white/40 block">Дата регистрации</span>
                20.12.2022
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5 mt-8 pt-5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} ЮГ ТРАНСФЕР · все системы в норме</p>
          <div className="flex items-center gap-3">
            <a href="/privacy" className="hover:text-white transition-colors">
              Политика конфиденциальности
            </a>
            <span className="text-white/10">·</span>
            <a href="/offer" className="hover:text-white transition-colors">
              Оферта
            </a>
            <span className="text-white/10">·</span>
            <a
              href="/admin"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/10 hover:border-purple-500/50 hover:text-white transition-colors"
            >
              <Icon name="Lock" size={11} />
              Админка
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}