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

// Штатная схема калькулятора: jQuery -> Яндекс.Карты -> tariffCalc.js.
// Скрипт сам делает подсказки адресов, расчёт цены (пишет её в
// .calc__form__tarif__item__price и order_price) и отправку заявки.
export default function useTariffCalc(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    (async () => {
      try {
        await loadScript("https://code.jquery.com/jquery-3.7.1.min.js", "tc-jquery");
        if (cancelled) return;

        const mapsSrc = YANDEX_MAPS_API_KEY
          ? `https://api-maps.yandex.ru/2.1/?apikey=${YANDEX_MAPS_API_KEY}&lang=ru_RU`
          : `https://api-maps.yandex.ru/2.1/?lang=ru_RU`;
        await loadScript(mapsSrc, "tc-yandex-maps");
        if (cancelled) return;

        await loadScript(TARIFF_CALC_SCRIPT_URL, "tc-tariff-calc");
        if (cancelled) return;

        // DOMContentLoaded в SPA уже прошёл — запускаем инициализацию вручную:
        // сам калькулятор, карту и подсказки адресов.
        const w = window as unknown as {
          tariffCalc_init?: () => void;
          initMap?: () => void;
          initTariffAutocomplete?: () => void;
          ymaps?: { ready: (cb: () => void) => void };
        };
        setTimeout(() => {
          if (cancelled) return;
          try {
            if (typeof w.tariffCalc_init === "function") w.tariffCalc_init();
            if (w.ymaps && typeof w.ymaps.ready === "function") {
              w.ymaps.ready(() => {
                if (typeof w.initMap === "function") w.initMap();
                if (typeof w.initTariffAutocomplete === "function") w.initTariffAutocomplete();
              });
            } else if (typeof w.initTariffAutocomplete === "function") {
              w.initTariffAutocomplete();
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
