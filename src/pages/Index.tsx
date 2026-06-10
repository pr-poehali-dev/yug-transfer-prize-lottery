import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";

const BG = "https://cdn.poehali.dev/projects/c2bd1535-aa26-4a07-a3f6-51d547fc1da3/files/0ea8c632-dfa9-4e5c-8051-74474ecd91aa.jpg";

const Index = () => {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center relative"
      style={{ backgroundImage: `url(${BG})` }}
    >
      <div className="absolute inset-0 bg-black/40" />

      <header className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-[calc(100%-2rem)] max-w-5xl">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md shadow-lg">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Icon name="Car" size={18} className="text-white" />
            </div>
            <span className="font-bold text-white text-base md:text-lg">Мой Трансфер</span>
          </div>
          <Link to="/admin">
            <Button size="sm" variant="secondary" className="gap-1.5 text-xs h-8 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-white border border-white/20">
              <Icon name="LogIn" size={14} />
              Админ-панель
            </Button>
          </Link>
        </div>
      </header>

      <div className="relative z-10 text-center space-y-8 px-6">
        <h1 className="text-5xl md:text-6xl font-bold text-white drop-shadow-lg">
          МОЙ ТРАНСФЕР
        </h1>
        <p className="text-lg text-white/90 drop-shadow">
          Трансферы по всему югу России
        </p>
      </div>
    </div>
  );
};

export default Index;