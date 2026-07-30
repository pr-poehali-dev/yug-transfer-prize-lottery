import { useEffect } from "react";
import { YANDEX_MAPS_API_KEY, TARIFF_CALC_SCRIPT_URL } from "@/lib/tariffCalcConfig";

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

// Загружает jQuery -> Яндекс.Карты -> tariffCalc.js по порядку,
// когда форма калькулятора уже отрисована в DOM.
export default function useTariffCalc(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    (async () => {
      try {
        await loadScript("https://code.jquery.com/jquery-3.7.1.min.js", "tc-jquery");
        if (cancelled) return;

        const mapsSrc = `https://api-maps.yandex.ru/2.1/?apikey=${YANDEX_MAPS_API_KEY}&lang=ru_RU`;
        await loadScript(mapsSrc, "tc-yandex-maps");
        if (cancelled) return;

        // Скрипт калькулятора инициализируется по DOMContentLoaded,
        // поэтому подключаем его последним, когда форма уже в DOM.
        await loadScript(TARIFF_CALC_SCRIPT_URL, "tc-tariff-calc");
        if (cancelled) return;

        // DOMContentLoaded в SPA уже прошёл — запускаем инициализацию вручную.
        const w = window as unknown as {
          tariffCalc_init?: () => void;
          initMap?: () => void;
          initAutocompleteOnce?: () => void;
          ymaps?: { ready: (cb: () => void) => void };
        };
        setTimeout(() => {
          if (cancelled) return;
          try {
            if (typeof w.tariffCalc_init === "function") w.tariffCalc_init();
            if (w.ymaps && typeof w.initMap === "function") w.ymaps.ready(w.initMap);
            if (w.ymaps && typeof w.initAutocompleteOnce === "function") {
              w.ymaps.ready(w.initAutocompleteOnce);
            }
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