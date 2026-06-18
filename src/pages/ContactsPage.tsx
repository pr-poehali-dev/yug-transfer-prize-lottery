import { Link } from "react-router-dom";
import PageShell from "@/components/PageShell";
import Icon from "@/components/ui/icon";
import { SITE_PHONE } from "@/components/SiteHeader";

const CONTACTS = [
  { icon: "Phone", label: "Телефон", value: SITE_PHONE, href: "tel:+79901337795" },
  { icon: "Mail", label: "Почта", value: "info@moy-transfer.ru", href: "mailto:info@moy-transfer.ru" },
  { icon: "Clock", label: "Режим работы", value: "Круглосуточно, без выходных", href: "" },
  { icon: "MapPin", label: "Город", value: "Краснодарский край", href: "" },
];

export default function ContactsPage() {
  return (
    <PageShell title="Контакты" icon="Phone">
      <p className="text-white/70 mb-6">Свяжитесь с нами любым удобным способом — поможем подобрать машину и рассчитать стоимость.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {CONTACTS.map((c) => {
          const inner = (
            <div className="flex items-center gap-3 bg-[#1a1a1a]/95 rounded-2xl border border-white/10 p-4 h-full">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                <Icon name={c.icon} size={18} className="text-amber-400" />
              </div>
              <div>
                <div className="text-white/50 text-xs">{c.label}</div>
                <div className="text-white font-semibold">{c.value}</div>
              </div>
            </div>
          );
          return c.href ? (
            <a key={c.label} href={c.href} className="block hover:opacity-90 transition-opacity">{inner}</a>
          ) : (
            <div key={c.label}>{inner}</div>
          );
        })}
      </div>
      <Link to="/" className="inline-flex items-center gap-2 mt-7 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold transition-colors">
        <Icon name="Plus" size={18} /> Заказать трансфер
      </Link>
    </PageShell>
  );
}