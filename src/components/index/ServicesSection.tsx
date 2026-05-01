import Icon from "@/components/ui/icon";
import { SectionHeader } from "./shared";

export function ServicesSection() {
  const services = [
    {
      icon: "Plane",
      title: "Аэропорт",
      desc: "Встреча с табличкой, помощь с багажом. Адлер, Краснодар, Симферополь.",
      price: "от 1 500 ₽",
      color: "from-cyan-500 to-blue-600",
    },
    {
      icon: "Map",
      title: "Межгород",
      desc: "Поездки между городами юга. Фиксированная цена, без сюрпризов.",
      price: "от 3 000 ₽",
      color: "from-purple-500 to-pink-500",
    },
    {
      icon: "Building2",
      title: "По городу",
      desc: "Комфортные поездки внутри города. Любые расстояния.",
      price: "от 500 ₽",
      color: "from-orange-500 to-red-500",
    },
    {
      icon: "Mountain",
      title: "Экскурсии",
      desc: "Поездки по достопримечательностям Кубани и Крыма с водителем.",
      price: "от 5 000 ₽",
      color: "from-green-500 to-emerald-500",
    },
    {
      icon: "Briefcase",
      title: "Корпоратив",
      desc: "Регулярные поездки для компаний. Договор, безнал, отчётность.",
      price: "по запросу",
      color: "from-yellow-400 to-orange-500",
    },
    {
      icon: "Users",
      title: "Группы",
      desc: "Минивэны на 6-8 человек. Свадьбы, конференции, командировки.",
      price: "от 4 000 ₽",
      color: "from-pink-500 to-purple-600",
    },
  ];

  return (
    <div>
      <SectionHeader
        title="Наши услуги"
        subtitle="Выбирай направление и оформляй поездку в пару кликов"
        icon="Sparkles"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {services.map((s, i) => (
          <div
            key={s.title}
            className="card-glow rounded-2xl p-6 opacity-0-init animate-fade-in-up"
            style={{ animationDelay: `${i * 0.07}s`, animationFillMode: "forwards" }}
          >
            <div
              className={`w-14 h-14 mb-4 rounded-2xl bg-gradient-to-br ${s.color} flex items-center justify-center shadow-lg`}
            >
              <Icon name={s.icon} size={26} className="text-white" fallback="Circle" />
            </div>
            <h3 className="font-oswald text-2xl font-bold text-white mb-2">{s.title}</h3>
            <p className="text-sm text-muted-foreground mb-4">{s.desc}</p>
            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Цена</span>
              <span className="grad-text font-oswald text-xl font-bold">{s.price}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
