import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";

const cards = [
  {
    to: "/dispatch",
    icon: "Headset",
    title: "Диспетчерская",
    desc: "Заказы, архив и подписки водителей",
    grad: "from-purple-500 to-indigo-500",
    glow: "from-purple-600 to-indigo-600",
  },
  {
    to: "/posts",
    icon: "Send",
    title: "Посты в канал",
    desc: "Публикации, истории и автопостинг",
    grad: "from-pink-500 to-orange-400",
    glow: "from-pink-600 to-orange-500",
  },
  {
    to: "/cabinet",
    icon: "UserRound",
    title: "Личный кабинет",
    desc: "Клиент отслеживает статус своей заявки",
    grad: "from-emerald-500 to-teal-500",
    glow: "from-emerald-600 to-teal-600",
  },
];

export default function Hub() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen mesh-bg flex flex-col items-center justify-center p-4">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl grad-btn mb-5 text-3xl shadow-lg">
          🚐
        </div>
        <h1 className="font-oswald text-3xl md:text-4xl font-bold text-white">Мой Трансфер</h1>
        <p className="text-muted-foreground text-sm mt-2">Панель управления — выбери раздел</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full max-w-4xl">
        {cards.map((c) => (
          <button
            key={c.to}
            onClick={() => navigate(c.to)}
            className="group relative text-left"
          >
            <div className={`absolute -inset-0.5 bg-gradient-to-r ${c.glow} rounded-3xl blur opacity-25 group-hover:opacity-60 transition-opacity`} />
            <div className="relative glass rounded-3xl border border-white/10 p-6 h-full overflow-hidden transition-transform group-hover:-translate-y-1">
              <div className="h-1 -mx-6 -mt-6 mb-5 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400" />
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${c.grad} flex items-center justify-center mb-4 shadow-lg`}>
                <Icon name={c.icon} size={26} className="text-white" />
              </div>
              <h2 className="font-oswald text-xl font-bold text-white mb-1">{c.title}</h2>
              <p className="text-muted-foreground text-sm leading-snug">{c.desc}</p>
              <div className="flex items-center gap-1.5 mt-5 text-sm font-medium text-white/80 group-hover:text-white transition-colors">
                Войти
                <Icon name="ArrowRight" size={15} className="transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </button>
        ))}
      </div>

      <a href="/" className="mt-10 text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1.5">
        <Icon name="ArrowLeft" size={13} />На сайт
      </a>
    </div>
  );
}