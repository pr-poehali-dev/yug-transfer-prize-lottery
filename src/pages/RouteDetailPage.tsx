import { useParams, Link } from "react-router-dom";
import { useEffect } from "react";
import PageShell from "@/components/PageShell";
import Icon from "@/components/ui/icon";
import useSEO from "@/hooks/useSEO";
import { getRoute, INCLUDED } from "@/data/routesData";
import NotFound from "@/pages/NotFound";

const PHONE = "+7 (990) 133-77-95";
const PHONE_TEL = "+79901337795";
const PHONE_DIGITS = "79901337795";

export default function RouteDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const route = slug ? getRoute(slug) : undefined;

  useSEO({
    title: route
      ? `Трансфер ${route.from} — ${route.to}: цена ${route.priceFrom}, время ${route.time} | Юг-Трансфер`
      : "Направление не найдено",
    description: route
      ? `Заказать трансфер ${route.from} — ${route.to}. Расстояние ${route.distance}, время в пути ${route.time}, стоимость ${route.priceFrom}. Подача к адресу, фиксированная цена, оплата после поездки.`
      : "",
  });

  useEffect(() => {
    if (!route) return;
    const ld = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: route.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    };
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.text = JSON.stringify(ld);
    document.head.appendChild(el);
    return () => {
      document.head.removeChild(el);
    };
  }, [route]);

  if (!route) return <NotFound />;

  const waText = encodeURIComponent(`Здравствуйте! Хочу заказать трансфер ${route.from} — ${route.to}.`);

  return (
    <PageShell title={`${route.from} → ${route.to}`} icon="Route">
      <Link to="/directions" className="inline-flex items-center gap-1.5 text-white/50 hover:text-amber-400 text-sm mb-4 transition-colors">
        <Icon name="ChevronLeft" size={15} /> Все направления
      </Link>

      <div className="bg-[#1a1a1a]/95 rounded-2xl border border-white/10 p-5 mb-6">
        <p className="text-white/80 leading-relaxed mb-4">{route.intro}</p>
        <div className="grid grid-cols-3 gap-3 mb-5">
          <Stat icon="Clock" label="В пути" value={route.time} />
          <Stat icon="MapPin" label="Расстояние" value={route.distance} />
          <Stat icon="Wallet" label="Стоимость" value={route.priceFrom} />
        </div>
        <div className="flex flex-wrap gap-2.5">
          <a href={`tel:${PHONE_TEL}`} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold transition-colors">
            <Icon name="Phone" size={18} /> Позвонить
          </a>
          <a href={`https://wa.me/${PHONE_DIGITS}?text=${waText}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#25D366] hover:opacity-90 text-white font-bold transition-opacity">
            <Icon name="MessageCircle" size={18} /> WhatsApp
          </a>
          <a href="https://t.me/ug_transfer_online" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#2AABEE] hover:opacity-90 text-white font-bold transition-opacity">
            <Icon name="Send" size={18} /> Telegram
          </a>
        </div>
      </div>

      <Section title="Стоимость по классам авто" icon="Car">
        <div className="grid sm:grid-cols-3 gap-3">
          {route.prices.map((p) => (
            <div key={p.car} className="bg-[#1a1a1a]/95 rounded-2xl border border-white/10 p-4">
              <div className="text-white font-semibold">{p.car}</div>
              <div className="text-white/50 text-sm mb-2">{p.pax}</div>
              <div className="text-amber-400 font-bold text-lg">{p.price}</div>
            </div>
          ))}
        </div>
        <p className="text-white/40 text-xs mt-2">Цены ориентировочные. Точную стоимость рассчитаем под ваш заказ — она фиксируется заранее.</p>
      </Section>

      <Section title="Что входит в стоимость" icon="CircleCheck">
        <div className="grid sm:grid-cols-2 gap-2.5">
          {INCLUDED.map((i) => (
            <div key={i} className="flex items-center gap-2.5 bg-[#1a1a1a]/95 rounded-xl border border-white/10 px-3.5 py-2.5">
              <Icon name="Check" size={16} className="text-amber-400 shrink-0" />
              <span className="text-white/80 text-sm">{i}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="О поездке" icon="Info">
        <div className="bg-[#1a1a1a]/95 rounded-2xl border border-white/10 p-5 space-y-3">
          {route.description.map((p, idx) => (
            <p key={idx} className="text-white/80 leading-relaxed">{p}</p>
          ))}
        </div>
      </Section>

      <Section title="Как заказать" icon="ListChecks">
        <div className="grid sm:grid-cols-3 gap-3">
          <Step n={1} title="Оставьте заявку" text="Позвоните или напишите в мессенджер — назовите адрес и время." />
          <Step n={2} title="Подтверждаем" text="Согласуем авто и фиксированную цену поездки." />
          <Step n={3} title="Едем" text="Водитель подаёт машину и везёт к месту. Оплата после поездки." />
        </div>
      </Section>

      <Section title="Частые вопросы" icon="MessageCircleQuestion">
        <div className="space-y-2.5">
          {route.faq.map((f) => (
            <div key={f.q} className="bg-[#1a1a1a]/95 rounded-2xl border border-white/10 p-4">
              <div className="text-white font-semibold mb-1.5">{f.q}</div>
              <div className="text-white/70 text-sm leading-relaxed">{f.a}</div>
            </div>
          ))}
        </div>
      </Section>

      <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-5 mt-7 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-white font-bold text-lg">Заказать трансфер {route.from} — {route.to}</div>
          <a href={`tel:${PHONE_TEL}`} className="text-amber-400 font-bold text-lg hover:text-amber-300 transition-colors">{PHONE}</a>
        </div>
        <a href={`tel:${PHONE_TEL}`} className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold transition-colors">
          <Icon name="Phone" size={18} /> Позвонить
        </a>
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

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <div className="bg-[#1a1a1a]/95 rounded-2xl border border-white/10 p-4">
      <div className="w-8 h-8 rounded-full bg-amber-500 text-black font-bold flex items-center justify-center mb-2.5">{n}</div>
      <div className="text-white font-semibold mb-1">{title}</div>
      <div className="text-white/60 text-sm leading-relaxed">{text}</div>
    </div>
  );
}
