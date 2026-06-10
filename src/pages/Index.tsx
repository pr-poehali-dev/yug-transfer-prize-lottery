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

      <Link to="/admin" className="absolute top-4 right-4 z-20">
        <Button size="sm" variant="secondary" className="gap-1.5 text-xs h-8 px-3 rounded-lg shadow-lg bg-white/15 hover:bg-white/25 text-white border border-white/20 backdrop-blur-sm">
          <Icon name="LogIn" size={14} />
          Админ-панель
        </Button>
      </Link>

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