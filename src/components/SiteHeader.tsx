import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";

const NAV = [
  { to: "/routes", label: "Маршруты" },
  { to: "/prices", label: "Цены" },
  { to: "/contacts", label: "Контакты" },
];

export default function SiteHeader() {
  const { pathname } = useLocation();

  return (
    <header className="sticky top-0 z-20 w-full">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-white/10 border-b border-white/20 backdrop-blur-md shadow-lg">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
            <Icon name="Car" size={18} className="text-white" />
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

        <div className="flex items-center gap-2">
          <Link to="/cabinet">
            <Button size="sm" variant="secondary" className="gap-1.5 text-xs h-8 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-white border border-white/20">
              <Icon name="UserRound" size={14} />
              <span className="hidden sm:inline">Личный кабинет</span>
            </Button>
          </Link>
          <Link to="/admin">
            <Button size="sm" variant="secondary" className="gap-1.5 text-xs h-8 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-white border border-white/20">
              <Icon name="LogIn" size={14} />
              <span className="hidden sm:inline">Админ-панель</span>
            </Button>
          </Link>
        </div>
      </div>

      <nav className="md:hidden flex items-center justify-center gap-1 px-4 py-2 bg-black/40 border-b border-white/10">
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              pathname === n.to ? "text-amber-400" : "text-white/80"
            }`}
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
