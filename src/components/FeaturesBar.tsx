import Icon from "@/components/ui/icon";

const FEATURES = [
  { icon: "Clock", label: "Подача 10 мин" },
  { icon: "MapPin", label: "По всей России" },
  { icon: "ShieldCheck", label: "Безопасность" },
  { icon: "BadgeRussianRuble", label: "Фикс. цена" },
];

const FeaturesBar = () => {
  return (
    <div className="fixed z-20 flex flex-wrap items-center gap-2 pointer-events-none bottom-4 left-4 right-4 lg:left-[560px] lg:right-80 lg:justify-between">
      {FEATURES.map((f) => (
        <div
          key={f.label}
          className="pointer-events-auto flex items-center gap-1.5 bg-[#1a1a1a]/95 backdrop-blur rounded-full border border-white/10 shadow-lg px-3 py-1.5"
        >
          <Icon name={f.icon} size={14} className="text-amber-400 shrink-0" />
          <span className="text-white text-xs font-medium whitespace-nowrap">{f.label}</span>
        </div>
      ))}
    </div>
  );
};

export default FeaturesBar;