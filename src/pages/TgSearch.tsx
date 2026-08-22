import { useEffect } from "react";

const REF_URL = "https://t.me/OneTMM_Bot?start=ref_6072837543";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        close: () => void;
        openTelegramLink: (url: string) => void;
      };
    };
  }
}

const TgSearch = () => {
  useEffect(() => {
    const go = () => {
      const wa = window.Telegram?.WebApp;
      if (wa) {
        wa.ready();
        wa.openTelegramLink(REF_URL);
        setTimeout(() => wa.close(), 100);
      } else {
        window.location.replace(REF_URL);
      }
    };

    if (window.Telegram?.WebApp) {
      go();
      return;
    }

    const s = document.createElement("script");
    s.src = "https://telegram.org/js/telegram-web-app.js";
    s.onload = go;
    s.onerror = () => window.location.replace(REF_URL);
    document.head.appendChild(s);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
      <p className="text-lg font-medium text-foreground">Открываем поиск заказов…</p>
    </div>
  );
};

export default TgSearch;
