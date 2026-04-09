import { useState } from "react";
import Icon from "@/components/ui/icon";

export function ContactsSection() {
  const [sent, setSent] = useState(false);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { icon: "Phone", label: "Телефон", value: "+7 (800) 555-35-35", color: "from-green-500 to-emerald-600" },
          { icon: "Mail", label: "Email", value: "support@raffle.ru", color: "from-purple-500 to-pink-600" },
          { icon: "MessageSquare", label: "Telegram", value: "@raffle_support", color: "from-cyan-500 to-blue-600" },
        ].map((c, i) => (
          <div
            key={c.label}
            className="card-glow rounded-2xl p-5 text-center opacity-0-init animate-fade-in-up"
            style={{ animationDelay: `${i * 0.1}s`, animationFillMode: "forwards" }}
          >
            <div className={`w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center`}>
              <Icon name={c.icon as string} size={20} className="text-white" fallback="Contact" />
            </div>
            <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider">{c.label}</p>
            <p className="text-white font-medium text-sm">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="card-glow rounded-2xl p-6">
        <h3 className="font-oswald text-2xl font-semibold text-white mb-5">Написать нам</h3>
        {sent ? (
          <div className="text-center py-10 animate-scale-in">
            <div className="text-6xl mb-4 animate-float inline-block">✅</div>
            <p className="font-oswald text-2xl font-bold text-white mb-2">Сообщение отправлено!</p>
            <p className="text-muted-foreground">Ответим в течение 2 часов</p>
            <button
              onClick={() => setSent(false)}
              className="mt-6 px-6 py-2 rounded-xl border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 transition-colors text-sm"
            >
              Написать ещё
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block font-medium uppercase tracking-wider">Имя</label>
                <input
                  type="text"
                  className="w-full glass rounded-xl px-4 py-3 text-white placeholder-muted-foreground focus:outline-none focus:border-purple-500/60 border border-transparent transition-colors bg-white/5 text-sm"
                  placeholder="Ваше имя"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block font-medium uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  className="w-full glass rounded-xl px-4 py-3 text-white placeholder-muted-foreground focus:outline-none focus:border-purple-500/60 border border-transparent transition-colors bg-white/5 text-sm"
                  placeholder="your@email.ru"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium uppercase tracking-wider">Сообщение</label>
              <textarea
                rows={4}
                className="w-full glass rounded-xl px-4 py-3 text-white placeholder-muted-foreground focus:outline-none focus:border-purple-500/60 border border-transparent transition-colors resize-none bg-white/5 text-sm"
                placeholder="Ваш вопрос или предложение..."
              />
            </div>
            <button type="submit" className="w-full grad-btn rounded-xl py-3.5 font-semibold font-golos">
              Отправить сообщение
            </button>
          </form>
        )}
      </div>

      <div className="mt-6 card-glow rounded-2xl p-6">
        <h3 className="font-oswald text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Icon name="HelpCircle" size={20} className="text-cyan-400" />
          Частые вопросы
        </h3>
        <div className="space-y-3">
          {[
            { q: "Как участвовать в розыгрыше?", a: "Выберите розыгрыш, оплатите участие и ждите результатов." },
            { q: "Когда объявляются победители?", a: "Победитель объявляется сразу после окончания розыгрыша." },
            { q: "Как получить приз?", a: "Мы свяжемся с победителем по email в течение 24 часов." },
          ].map((faq, i) => (
            <div key={i} className="glass rounded-xl p-4">
              <p className="text-white font-medium text-sm mb-1">❓ {faq.q}</p>
              <p className="text-muted-foreground text-sm">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
