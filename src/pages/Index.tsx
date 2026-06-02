import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";

const Index = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold text-black">ЮГ-ТРАНСФЕР</h1>
        <Link to="/admin">
          <Button size="lg" className="gap-2">
            <Icon name="LogIn" size={20} />
            Вход в админку
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default Index;
