import Icon from "@/components/ui/icon";

interface PrivacyModalProps {
  open: boolean;
  onClose: () => void;
}

export function PrivacyModal({ open, onClose }: PrivacyModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full md:max-w-2xl max-h-[90dvh] flex flex-col bg-[#0f0a1e] border border-white/10 rounded-t-3xl md:rounded-3xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <Icon name="Shield" size={20} className="text-emerald-400" />
            <h2 className="font-oswald text-lg font-bold text-white">Политика конфиденциальности</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
          >
            <Icon name="X" size={16} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-6 text-sm text-white/80 leading-relaxed">
          <p className="text-white/60">
            Настоящая Политика конфиденциальности определяет порядок обработки и защиты персональных данных
            пользователей, участвующих в розыгрышах, конкурсах и акциях, проводимых сервисом{" "}
            <span className="text-white font-medium">«Юг-Трансфер»</span>.
          </p>

          <div className="flex flex-wrap gap-3 text-xs text-white/50">
            <a href="https://ug-transfer.online" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1">
              <Icon name="Globe" size={12} /> ug-transfer.online
            </a>
            <a href="https://t.me/ug_transfer_online" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1">
              <Icon name="Send" size={12} /> @ug_transfer_online
            </a>
            <a href="https://wa.me/79956141414" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1">
              <Icon name="Phone" size={12} /> +7 (995) 614-14-14
            </a>
          </div>

          <section>
            <h3 className="font-oswald text-base font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-lg">📋</span> 1. Какие данные мы собираем
            </h3>
            <p className="text-white/60 mb-2">При участии в розыгрыше вы можете предоставить:</p>
            <ul className="space-y-1.5 pl-1">
              <li>• Имя (указывается в профиле Telegram/WhatsApp или при заполнении формы)</li>
              <li>• Номер телефона (если требуется для связи или подтверждения участия)</li>
              <li>• Адрес электронной почты (при наличии)</li>
              <li>• Скриншоты, комментарии или иные материалы, размещённые вами по условиям акции</li>
            </ul>
          </section>

          <section>
            <h3 className="font-oswald text-base font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-lg">🎯</span> 2. Цель обработки данных
            </h3>
            <p className="text-white/60 mb-2">Ваши данные используются <span className="text-white font-medium">исключительно</span> для:</p>
            <ul className="space-y-1.5 pl-1">
              <li>• Идентификации победителя</li>
              <li>• Связи с вами для вручения приза</li>
              <li>• Подтверждения выполнения условий розыгрыша</li>
              <li>• Публикации результатов (только с вашего согласия — например, упоминание имени или username)</li>
            </ul>
            <div className="mt-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-xs text-emerald-200">
              🛡️ Мы <span className="font-medium">не передаём</span> ваши данные третьим лицам, кроме случаев, прямо указанных в условиях конкретного розыгрыша (например, партнёрская акция с прозрачным описанием).
            </div>
          </section>

          <section>
            <h3 className="font-oswald text-base font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-lg">✋</span> 3. Добровольное участие
            </h3>
            <p>
              Участие в розыгрыше — <span className="text-white font-medium">добровольное</span>. Вы вправе отказаться от участия в любой момент,
              отправив сообщение в Telegram{" "}
              <a href="https://t.me/ug_transfer_online" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">@ug_transfer_online</a>{" "}
              или по WhatsApp.
            </p>
          </section>

          <section>
            <h3 className="font-oswald text-base font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-lg">🗄️</span> 4. Хранение данных
            </h3>
            <p>
              Персональные данные участников хранятся <span className="text-white font-medium">до окончания розыгрыша и вручения призов</span>,
              после чего удаляются, если иное не предусмотрено законодательством РФ.
            </p>
          </section>

          <section>
            <h3 className="font-oswald text-base font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-lg">🔐</span> 5. Безопасность
            </h3>
            <p>
              Мы принимаем все разумные меры для защиты ваших данных от несанкционированного доступа,
              изменения, раскрытия или уничтожения. Обработка данных осуществляется в соответствии
              с <span className="text-white font-medium">ФЗ-152 «О персональных данных»</span>.
            </p>
          </section>

          <section>
            <h3 className="font-oswald text-base font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-lg">🔄</span> 6. Изменения в политике
            </h3>
            <p>
              Администрация оставляет за собой право вносить изменения в настоящую Политику конфиденциальности.
              Актуальная версия всегда доступна на сайте{" "}
              <a href="https://ug-gift.ru" className="text-purple-400 hover:underline">ug-gift.ru</a>.
            </p>
          </section>

          <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 px-4 py-3 text-xs text-purple-200">
            🛡️ <span className="font-medium">Спасибо, что доверяете «Юг-Трансфер»!</span> Ваши данные — в безопасности.
          </div>

          <div className="h-2" />
        </div>
      </div>
    </div>
  );
}

export default PrivacyModal;
