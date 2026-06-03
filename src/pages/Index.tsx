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
      <div className="relative z-10 text-center space-y-8 px-6">
        <h1 className="text-5xl md:text-6xl font-bold text-white drop-shadow-lg">
          ЮГ-ТРАНСФЕР
        </h1>
        <p className="text-lg text-white/90 drop-shadow">
          Трансферы по всему югу России
        </p>
        <Link to="/admin">
          <Button size="lg" className="gap-2 text-base px-8 py-6 rounded-xl shadow-xl">
            <Icon name="LogIn" size={20} />
            Вход в админ-панель
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default Index;
