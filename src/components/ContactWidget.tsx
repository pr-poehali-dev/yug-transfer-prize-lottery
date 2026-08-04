import Icon from "@/components/ui/icon";

const PHONE = "+7 (978) 109-28-75";
const PHONE_TEL = "+79781092875";

const ContactWidget = () => {
  return (
    <div className="hidden lg:block fixed bottom-4 right-4 z-30 max-w-[calc(100vw-2rem)]">
      <div className="bg-[#1a1a1a]/95 backdrop-blur rounded-2xl border border-white/10 shadow-2xl px-4 py-3">
        <a href={`tel:${PHONE_TEL}`} className="block text-white font-bold text-lg leading-tight hover:text-amber-400 transition-colors">
          {PHONE}
        </a>
        <p className="text-white/50 text-xs mt-0.5 mb-2.5">Закажите по телефону или в мессенджере</p>
        <div className="flex items-center gap-2">
          <a
            href="https://t.me/Dispether82"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Telegram"
            className="w-9 h-9 rounded-full bg-[#2AABEE] hover:opacity-90 flex items-center justify-center transition-opacity"
          >
            <Icon name="Send" size={16} className="text-white" />
          </a>
          <a
            href="https://max.ru/u/f9LHodD0cOIMaVYO_Z-nUVm8RnfeFCYBL1plEAksXVd6OihrEdaQR7wxrpU"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="MAX"
            className="w-9 h-9 rounded-full overflow-hidden hover:opacity-90 flex items-center justify-center transition-opacity"
          >
            <img src="/max-logo.jpeg" alt="MAX" className="w-full h-full object-cover" />
          </a>
          <a
            href={`tel:${PHONE_TEL}`}
            aria-label="Позвонить"
            className="w-9 h-9 rounded-full bg-[#9B6BF5] hover:opacity-90 flex items-center justify-center transition-opacity"
          >
            <Icon name="Phone" size={16} className="text-white" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default ContactWidget;