import { useEffect } from "react";
import { TARIFF_CALC_SCRIPT_URL } from "@/lib/tariffCalcConfig";

function loadScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === "1") resolve();
      else {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error(`fail ${src}`)));
      }
      return;
    }
    const s = document.createElement("script");
    s.id = id;
    s.src = src;
    s.async = false;
    s.addEventListener("load", () => {
      s.dataset.loaded = "1";
      resolve();
    });
    s.addEventListener("error", () => reject(new Error(`fail ${src}`)));
    document.body.appendChild(s);
  });
}

// Загружает jQuery -> tariffCalc.js по порядку,
// когда форма калькулятора уже отрисована в DOM.
// Яндекс.Карты НЕ грузим: подсказки адресов и расчёт цены считаются на
// стороне vse-zakazy.ru (get_yandex_key.php + серверный геокодер), а
// визуальная карта на домене poehali.dev самим скриптом не инициализируется.
export default function useTariffCalc(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    (async () => {
      try {
        await loadScript("https://code.jquery.com/jquery-3.7.1.min.js", "tc-jquery");
        if (cancelled) return;

        // Скрипт калькулятора инициализируется по DOMContentLoaded,
        // поэтому подключаем его последним, когда форма уже в DOM.
        await loadScript(TARIFF_CALC_SCRIPT_URL, "tc-tariff-calc");
        if (cancelled) return;

        // DOMContentLoaded в SPA уже прошёл, поэтому запускаем инициализацию
        // вручную: сам калькулятор и подсказки адресов (работают через
        // серверный геокодер vse-zakazy.ru, без Яндекс.Карт).
        const w = window as unknown as {
          tariffCalc_init?: () => void;
          initTariffAutocomplete?: () => void;
        };
        setTimeout(() => {
          if (cancelled) return;
          try {
            if (typeof w.tariffCalc_init === "function") w.tariffCalc_init();
            if (typeof w.initTariffAutocomplete === "function") w.initTariffAutocomplete();
          } catch (err) {
            console.error("[tariffCalc] ошибка инициализации", err);
          }
        }, 300);
      } catch (e) {
        console.error("[tariffCalc] не удалось загрузить скрипты калькулятора", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready]);
}