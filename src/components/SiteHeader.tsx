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
          <span className="font-bold text-white text-base md:text-lg">Мой Трансфер</span>
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
          <Link to="/cabinet" className="hidden md:block">
            <Button size="sm" variant="secondary" className="gap-1.5 text-xs h-8 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-white border border-white/20">
              <Icon name="UserRound" size={14} />
              Личный кабинет
            </Button>
          </Link>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Меню"
            className="md:hidden w-9 h-9 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 flex items-center justify-center text-white"
          >
            <Icon name={open ? "X" : "Menu"} size={20} />
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden bg-[#1a1a1a]/95 backdrop-blur-md border-b border-white/10 shadow-xl">
          <nav className="flex flex-col px-4 py-2">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2 px-2 py-3 rounded-lg text-base font-medium border-b border-white/5 transition-colors ${
                  pathname === n.to ? "text-amber-400" : "text-white/90"
                }`}
              >
                {n.label}
              </Link>
            ))}
            <a
              href={`tel:${PHONE_TEL}`}
              className="flex items-center gap-2 px-2 py-3 text-amber-400 font-semibold border-b border-white/5"
            >
              <Icon name="Phone" size={16} />
              {SITE_PHONE}
            </a>
            <Link to="/cabinet" onClick={() => setOpen(false)} className="py-3">
              <Button className="w-full gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold">
                <Icon name="UserRound" size={16} />
                Личный кабинет
              </Button>
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}