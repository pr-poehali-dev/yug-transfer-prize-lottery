import Icon from "@/components/ui/icon";

const PHONE = "+7 (984) 334-87-24";
const PHONE_TEL = "+79843348724";
const PHONE_DIGITS = "79843348724";

const ContactWidget = () => {
  return (
    <div className="fixed bottom-4 right-4 z-30 max-w-[calc(100vw-2rem)]">
      <div className="bg-[#1a1a1a]/95 backdrop-blur rounded-2xl border border-white/10 shadow-2xl px-4 py-3">
        <a href={`tel:${PHONE_TEL}`} className="block text-white font-bold text-lg leading-tight hover:text-amber-400 transition-colors">
          {PHONE}
        </a>
        <p className="text-white/50 text-xs mt-0.5 mb-2.5">Закажите по телефону или в мессенджере</p>
        <div className="flex items-center gap-2">
          <a
            href={`https://t.me/${PHONE_DIGITS}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Telegram"
            className="w-9 h-9 rounded-full bg-[#2AABEE] hover:opacity-90 flex items-center justify-center transition-opacity"
          >
            <Icon name="Send" size={16} className="text-white" />
          </a>
          <a
            href={`https://wa.me/${PHONE_DIGITS}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp"
            className="w-9 h-9 rounded-full bg-[#25D366] hover:opacity-90 flex items-center justify-center transition-opacity"
          >
            <Icon name="MessageCircle" size={16} className="text-white" />
          </a>
          <a
            href="https://max.ru/u/f9LHodD0cOLzdRDodXNdc9djrpZZdu-v0zZD4IeF_lUFvaKexfCu8S7gRtU"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="MAX"
            className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7C4DFF] to-[#4D7CFF] hover:opacity-90 flex items-center justify-center transition-opacity"
          >
            <span className="text-white text-xs font-bold leading-none">MAX</span>
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