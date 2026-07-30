import { useParams, Link } from "react-router-dom";
import PageShell from "@/components/PageShell";
import Icon from "@/components/ui/icon";
import useSEO from "@/hooks/useSEO";
import { getTariff } from "@/data/tariffsData";
import NotFound from "@/pages/NotFound";

const PHONE = "+7 (978) 109-28-75";
const PHONE_TEL = "+79781092875";

export default function TariffDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const tariff = slug ? getTariff(slug) : undefined;

  useSEO({
    title: tariff
      ? `Тариф «${tariff.name}» — ${tariff.price}, ${tariff.pax} | Мой Трансфер`
      : "Тариф не найден",
    description: tariff
      ? `Тариф «${tariff.name}»: ${tariff.desc}. Стоимость ${tariff.price}, вместимость ${tariff.pax}. Фиксированная цена, оплата после поездки. Закажите трансфер онлайн или по телефону.`
      : "",
  });

  if (!tariff) return <NotFound />;

  return (
    <PageShell title={`Тариф «${tariff.name}»`} icon={tariff.icon ?? "Car"}>
      <Link to="/tariffs" className="inline-flex items-center gap-1.5 text-white/50 hover:text-amber-400 text-sm mb-4 transition-colors">
        <Icon name="ChevronLeft" size={15} /> Все тарифы
      </Link>

      <div className="relative h-48 sm:h-64 rounded-2xl overflow-hidden border border-white/10 mb-6">
        <img
          src={tariff.image}
          alt={tariff.name}
          className={`w-full h-full object-cover ${tariff.objectTop ? "object-top" : ""} ${tariff.flip ? "scale-x-[-1]" : ""}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <span className="absolute top-3 right-3 bg-amber-500 text-black text-sm font-bold px-3 py-1.5 rounded-lg">{tariff.price}</span>
        <span className="absolute top-3 left-3 bg-black/70 text-white text-sm font-semibold px-3 py-1.5 rounded-lg">{tariff.pax}</span>
        <div className="absolute bottom-3 left-4 text-white font-bold text-2xl drop-shadow uppercase tracking-wide">
          {tariff.name}
        </div>
      </div>

      <div className="bg-[#1a1a1a]/95 rounded-2xl border border-white/10 p-5 mb-6">
        <p className="text-white/80 leading-relaxed mb-4">{tariff.intro}</p>
        <div className="grid grid-cols-2 gap-3 mb-5">
          <Stat icon="Wallet" label="Стоимость" value={tariff.price} />
          <Stat icon="Users" label="Вместимость" value={tariff.pax} />
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link to="/" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold transition-colors">
            <Icon name="Plus" size={18} /> Заказать
          </Link>
          <a href={`tel:${PHONE_TEL}`} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold transition-colors">
            <Icon name="Phone" size={18} /> Позвонить
          </a>
        </div>
      </div>

      <Section title="Что входит в тариф" icon="CircleCheck">
        <div className="grid sm:grid-cols-2 gap-2.5">
          {tariff.features.map((f) => (
            <div key={f} className="flex items-center gap-2.5 bg-[#1a1a1a]/95 rounded-xl border border-white/10 px-3.5 py-2.5">
              <Icon name="Check" size={16} className="text-amber-400 shrink-0" />
              <span className="text-white/80 text-sm">{f}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Автомобили тарифа" icon="Car">
        <div className="flex flex-wrap gap-2.5">
          {tariff.cars.map((c) => (
            <div key={c} className="bg-[#1a1a1a]/95 rounded-xl border border-white/10 px-4 py-2.5 text-white/80 text-sm">
              {c}
            </div>
          ))}
        </div>
        <p className="text-white/40 text-xs mt-2">Модель авто может отличаться — гарантируем класс и уровень комфорта тарифа.</p>
      </Section>

      <Section title="Кому подойдёт" icon="ThumbsUp">
        <div className="grid sm:grid-cols-3 gap-3">
          {tariff.bestFor.map((b) => (
            <div key={b} className="bg-[#1a1a1a]/95 rounded-2xl border border-white/10 p-4 flex items-start gap-2.5">
              <Icon name="CircleCheck" size={18} className="text-amber-400 shrink-0 mt-0.5" />
              <span className="text-white/80 text-sm leading-snug">{b}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Подробнее о тарифе" icon="Info">
        <div className="bg-[#1a1a1a]/95 rounded-2xl border border-white/10 p-5 space-y-3">
          {tariff.description.map((p, idx) => (
            <p key={idx} className="text-white/80 leading-relaxed">{p}</p>
          ))}
        </div>
      </Section>

      <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-5 mt-7 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-white font-bold text-lg">Заказать тариф «{tariff.name}»</div>
          <a href={`tel:${PHONE_TEL}`} className="text-amber-400 font-bold text-lg hover:text-amber-300 transition-colors">{PHONE}</a>
        </div>
        <Link to="/" className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold transition-colors">
          <Icon name="Plus" size={18} /> Оставить заявку
        </Link>
      </div>
    </PageShell>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-black/30 rounded-xl border border-white/10 px-3 py-2.5 text-center">
      <Icon name={icon} size={16} className="text-amber-400 mx-auto mb-1" />
      <div className="text-white/40 text-[11px]">{label}</div>
      <div className="text-white font-bold text-sm">{value}</div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="flex items-center gap-2 text-white font-bold text-lg mb-3">
        <Icon name={icon} size={18} className="text-amber-400" /> {title}
      </h2>
      {children}
    </div>
  );
}
