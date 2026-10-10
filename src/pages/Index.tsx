import Icon from "@/components/ui/icon";

export default function Index() {
  return (
    <div className="min-h-screen bg-[#0b0d14] text-white flex flex-col items-center justify-center px-6">
      <div className="w-16 h-16 rounded-2xl grad-btn flex items-center justify-center mb-6">
        <Icon name="Send" size={28} className="text-white" />
      </div>
      <h1 className="text-3xl md:text-4xl font-bold text-center mb-3">Скоро здесь будет новый сайт</h1>
      <p className="text-white/50 text-center max-w-md mb-8">Мы готовим обновлённую страницу. Загляните немного позже.</p>
      <a href="/posts"
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 text-white/70 hover:text-white hover:bg-white/5 transition-all text-sm">
        <Icon name="LogIn" size={16} />Вход для администратора
      </a>
    </div>
  );
}
