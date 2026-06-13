import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";

const NAV = [
  { to: "/directions", label: "Направления" },
  { to: "/tariffs", label: "Тарифы" },
  { to: "/contacts", label: "Контакты" },
];

export const SITE_PHONE = "+7 (995) 614-14-14";
const PHONE_TEL = "+79956141414";

export default function SiteHeader() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <header ref={headerRef} className="sticky top-0 z-20 w-full">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-white/10 border-b border-white/20 backdrop-blur-md shadow-lg">
        <Link to="/" onClick={() => setOpen(false)} className="flex items-center gap-2 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center overflow-hidden shrink-0">
            <img
              src="https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/bucket/64907c55-9fa4-41c3-8060-94e8e73046d4.jpg"
              alt="Мой Трансфер"
              className="w-full h-full object-cover"
            />
          </div>
          <span className="hidden md:inline font-bold text-white text-base md:text-lg">Мой Трансфер</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === n.to ? "text-amber-400" : "text-white/80 hover:text-white"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a href={`tel:${PHONE_TEL}`} className="hidden md:flex items-center gap-1.5 text-white font-semibold text-sm hover:text-amber-400 transition-colors whitespace-nowrap">
            <Icon name="Phone" size={14} className="text-amber-400" />
            {SITE_PHONE}
          </a>
          <a
            href="https://t.me/ug_transfer_online"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Telegram"
            className="hidden md:flex w-8 h-8 rounded-full bg-[#2AABEE] hover:opacity-90 items-center justify-center transition-opacity shrink-0"
          >
            <Icon name="Send" size={15} className="text-white" />
          </a>
          <a
            href="https://max.ru/u/f9LHodD0cOI0G4brAI4KCKvVahfV0mnfAqqlH0Coj23Qfu8YvsF3FHXX84E"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="MAX"
            className="hidden md:flex w-8 h-8 rounded-full bg-gradient-to-br from-[#7C4DFF] to-[#4D7CFF] hover:opacity-90 items-center justify-center transition-opacity shrink-0"
          >
            <span className="text-white text-[10px] font-bold leading-none">MAX</span>
          </a>
          <Link to="/cabinet" className="hidden md:block">
            <Button size="sm" variant="secondary" className="gap-1.5 text-xs h-8 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-white border border-white/20">
              <Icon name="UserRound" size={14} />
              Личный кабинет
            </Button>
          </Link>

          <a
            href={`tel:${PHONE_TEL}`}
            aria-label="Позвонить"
            className="md:hidden flex items-center gap-1 text-white font-semibold text-xs whitespace-nowrap"
          >
            <Icon name="Phone" size={13} className="text-amber-400" />
            {SITE_PHONE}
          </a>
          <a
            href="https://t.me/ug_transfer_online"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Telegram"
            className="md:hidden flex w-8 h-8 rounded-full bg-[#2AABEE] items-center justify-center shrink-0"
          >
            <Icon name="Send" size={15} className="text-white" />
          </a>
          <a
            href="https://max.ru/u/f9LHodD0cOI0G4brAI4KCKvVahfV0mnfAqqlH0Coj23Qfu8YvsF3FHXX84E"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="MAX"
            className="md:hidden flex w-8 h-8 rounded-full bg-gradient-to-br from-[#7C4DFF] to-[#4D7CFF] items-center justify-center shrink-0"
          >
            <span className="text-white text-[10px] font-bold leading-none">MAX</span>
          </a>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Меню"
            className="md:hidden w-9 h-9 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 flex items-center justify-center text-white shrink-0"
          >
            <Icon name={open ? "X" : "Menu"} size={20} />
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden fixed inset-0 z-30 bg-[#0f0f0f]/98 backdrop-blur-md flex flex-col">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 shrink-0">
            <span className="font-bold text-white text-lg">Меню</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Закрыть"
              className="w-9 h-9 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 flex items-center justify-center text-white"
            >
              <Icon name="X" size={20} />
            </button>
          </div>
          <nav className="flex flex-col flex-1 px-6 py-4 gap-1 overflow-y-auto">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2 py-4 text-xl font-semibold border-b border-white/5 transition-colors ${
                  pathname === n.to ? "text-amber-400" : "text-white/90"
                }`}
              >
                {n.label}
              </Link>
            ))}
            <a
              href={`tel:${PHONE_TEL}`}
              className="flex items-center gap-2 py-4 text-amber-400 text-xl font-semibold border-b border-white/5"
            >
              <Icon name="Phone" size={20} />
              {SITE_PHONE}
            </a>
            <Link to="/cabinet" onClick={() => setOpen(false)} className="mt-auto pt-4">
              <Button className="w-full gap-2 h-12 text-base bg-amber-500 hover:bg-amber-400 text-black font-bold">
                <Icon name="UserRound" size={18} />
                Личный кабинет
              </Button>
            </Link>
          </nav>

          <footer className="shrink-0 px-6 pt-4 pb-6 border-t border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <a
                href="https://t.me/ug_transfer_online"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Telegram"
                className="w-10 h-10 rounded-full bg-[#2AABEE] flex items-center justify-center"
              >
                <Icon name="Send" size={18} className="text-white" />
              </a>
              <a
                href="https://max.ru/u/f9LHodD0cOI0G4brAI4KCKvVahfV0mnfAqqlH0Coj23Qfu8YvsF3FHXX84E"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="MAX"
                className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7C4DFF] to-[#4D7CFF] flex items-center justify-center"
              >
                <span className="text-white text-xs font-bold leading-none">MAX</span>
              </a>
              <a
                href={`https://wa.me/79956141414`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center"
              >
                <Icon name="MessageCircle" size={18} className="text-white" />
              </a>
            </div>
            <div className="space-y-1 text-white/60 text-sm">
              <div className="flex items-center gap-2">
                <Icon name="Clock" size={14} className="text-amber-400 shrink-0" />
                Круглосуточно, без выходных
              </div>
              <div className="flex items-center gap-2">
                <Icon name="MapPin" size={14} className="text-amber-400 shrink-0" />
                Краснодарский край, по всей России
              </div>
            </div>
            <p className="text-white/30 text-xs mt-3">© 2026 Мой Трансфер</p>
          </footer>
        </div>
      )}
    </header>
  );
}