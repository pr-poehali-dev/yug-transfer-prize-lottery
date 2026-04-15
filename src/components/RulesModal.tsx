import Icon from "@/components/ui/icon";

interface RulesModalProps {
  open: boolean;
  onClose: () => void;
}

export function RulesModal({ open, onClose }: RulesModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full md:max-w-2xl max-h-[90dvh] flex flex-col bg-[#0f0a1e] border border-white/10 rounded-t-3xl md:rounded-3xl overflow-hidden">
        {/* Шапка */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <Icon name="ScrollText" size={20} className="text-purple-400" />
            <h2 className="font-oswald text-lg font-bold text-white">Правила розыгрышей</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
          >
            <Icon name="X" size={16} />
          </button>
        </div>

        {/* Контент */}
        <div className="overflow-y-auto px-6 py-5 space-y-6 text-sm text-white/80 leading-relaxed">

          {/* Суть */}
          <section>
            <h3 className="font-oswald text-base font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-lg">🎯</span> Суть розыгрыша
            </h3>
            <ul className="space-y-1.5 pl-1">
              <li>• Вы вносите <span className="text-white font-medium">минимальный взнос</span>, указанный в карточке розыгрыша</li>
              <li>• При достижении <span className="text-white font-medium">порога сбора</span> автоматически определяется победитель</li>
              <li>• 🎲 Выбор случайный, честный, через ГСЧ</li>
            </ul>
          </section>

          {/* Порог и джекпот */}
          <section>
            <h3 className="font-oswald text-base font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-lg">💰</span> Минимальный порог и излишки
            </h3>
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <div className="grid grid-cols-2 bg-white/5 px-4 py-2 text-xs text-white/50 font-medium">
                <span>Если собрано</span>
                <span>Что происходит</span>
              </div>
              {[
                ["✅ Ровно порог", "Розыгрыш проводится, приз уходит победителю"],
                ["💰 Больше порога", "Излишки → в Джекпот 🚀"],
                ["❌ Меньше порога", "Розыгрыш переносится ИЛИ возврат средств"],
              ].map(([left, right], i) => (
                <div key={i} className={`grid grid-cols-2 px-4 py-2.5 gap-2 ${i % 2 === 0 ? "" : "bg-white/[0.02]"}`}>
                  <span className="text-white/70">{left}</span>
                  <span className="text-white/60">{right}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Джекпот */}
          <section>
            <h3 className="font-oswald text-base font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-lg">💎</span> Джекпот
            </h3>
            <ul className="space-y-1.5 pl-1">
              <li>• Джекпот — это <span className="text-white font-medium">накопительный призовой фонд</span>, который формируется из излишков розыгрышей</li>
              <li>• В джекпоте участвуют <span className="text-white font-medium">только те пользователи</span>, кто купил хотя бы 1 билет в любом розыгрыше</li>
              <li>• Чем больше розыгрышей вы участвуете — тем выше шанс попасть в число участников джекпота</li>
              <li>• 🎲 Победитель джекпота выбирается <span className="text-white font-medium">случайным образом</span> среди всех участников</li>
              <li>• 🗓 Розыгрыш джекпота проводится <span className="text-white font-medium">2 раза в год</span></li>
              <li>• 💰 Победитель получает <span className="text-white font-medium">всю накопленную сумму</span> джекпота</li>
            </ul>
            <p className="mt-2 text-xs text-white/40">📊 Текущий баланс и таймер джекпота — на главной странице в разделе «Джекпот»</p>
          </section>

          {/* Как участвовать */}
          <section>
            <h3 className="font-oswald text-base font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-lg">👤</span> Как участвовать
            </h3>
            <ol className="space-y-1.5 pl-1">
              {[
                "📝 Зарегистрируйтесь на ug-gift.ru через Telegram",
                "💳 Выберите розыгрыш и нажмите «Участвовать»",
                "💰 Внесите взнос — вы получите билет",
                "⏳ Дождитесь результатов розыгрыша",
                "💎 Вы автоматически попадаете в список участников Джекпота",
              ].map((s, i) => (
                <li key={i}>
                  <span className="text-white/40 mr-2">{i + 1}.</span>{s}
                </li>
              ))}
            </ol>
            <div className="mt-3 space-y-1 text-white/60">
              <p>✅ Участвовать могут лица <span className="text-white font-medium">18+</span>, резиденты РФ</p>
              <p>✅ Один аккаунт = один билет (если не указано иное)</p>
              <p>✅ Участие в любом розыгрыше = участие в Джекпоте</p>
            </div>
          </section>

          {/* Победитель */}
          <section>
            <h3 className="font-oswald text-base font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-lg">🏆</span> Победитель и приз
            </h3>
            <ul className="space-y-1.5 pl-1">
              <li>• 🎲 Победитель выбирается <span className="text-white font-medium">автоматически</span> после сбора порога</li>
              <li>• 🔔 Уведомление: личный кабинет + email + SMS</li>
              <li>• 📦 Приз: доставка за наш счёт / перевод на карту / промокод</li>
              <li>• ⏰ Если победитель не вышел на связь за <span className="text-white font-medium">72 часа</span> — розыгрыш повторяется</li>
            </ul>
          </section>

          {/* Возврат */}
          <section>
            <h3 className="font-oswald text-base font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-lg">↩️</span> Возврат средств
            </h3>
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <div className="grid grid-cols-2 bg-white/5 px-4 py-2 text-xs text-white/50 font-medium">
                <span>Когда</span>
                <span>Возврат</span>
              </div>
              {[
                ["До сбора порога", "✅ 100%"],
                ["После порога, но до розыгрыша", "✅ 90% (10% — комиссия)"],
                ["После определения победителя", "❌ Не возвращается"],
              ].map(([when, back], i) => (
                <div key={i} className={`grid grid-cols-2 px-4 py-2.5 gap-2 ${i % 2 === 0 ? "" : "bg-white/[0.02]"}`}>
                  <span className="text-white/70">{when}</span>
                  <span className="text-white/60">{back}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Важно */}
          <section>
            <h3 className="font-oswald text-base font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-lg">⚠️</span> Важно
            </h3>
            <ul className="space-y-1.5 pl-1">
              <li>• ❌ Запрещено: мультиаккаунты, боты, накрутка</li>
              <li>• 🔐 Ваши данные защищены (ФЗ-152), не передаются третьим лицам</li>
              <li>• 🔄 Организатор вправе менять правила — новая версия публикуется на сайте</li>
            </ul>
          </section>

          {/* Поддержка */}
          <section>
            <h3 className="font-oswald text-base font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-lg">📞</span> Поддержка
            </h3>
            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 flex flex-wrap gap-4 text-white/60">
              <span>💬 Чат на сайте</span>
              <span>📧 support@ug-gift.ru</span>
              <span>🤖 Telegram-бот</span>
            </div>
          </section>

          {/* Согласие */}
          <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 px-4 py-3 text-xs text-purple-200">
            ☑️ <span className="font-medium">Нажимая «Участвовать»</span>, вы подтверждаете, что ознакомились с Правилами и согласны с ними.
          </div>

          <div className="h-2" />
        </div>
      </div>
    </div>
  );
}