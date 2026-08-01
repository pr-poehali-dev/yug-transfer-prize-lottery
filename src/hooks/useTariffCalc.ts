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
// Раскладываем цены по ВСЕМ карточкам тарифов: берём costAllTariff из ответа
// сервера и пишем цену в каждую карточку по названию тарифа (title). Не зависит
// от внутренней логики скрипта — цены появляются сразу на всех тарифах.
function applyAllTariffPrices(costAll: Record<string, number> | null | undefined) {
  if (!costAll) return;
  // Кэшируем цены всех тарифов, чтобы при клике подставлять без пересчёта.
  (window as unknown as { __tariffPrices?: Record<string, number> }).__tariffPrices = costAll;
  const cards = document.querySelectorAll<HTMLElement>(".calc__form__tarif__item");
  cards.forEach((card) => {
    const title = (card.querySelector(".calc__form__tarif__item__title")?.textContent || "").trim();
    const priceEl = card.querySelector<HTMLElement>(".calc__form__tarif__item__price");
    if (!priceEl) return;
    const cost = costAll[title];
    if (typeof cost === "number" && cost > 0) {
      priceEl.textContent = new Intl.NumberFormat("ru-RU").format(cost) + " \u20BD";
      card.dataset.hasPrice = "1";
    }
  });
}

// Сбросить кэш цен (маршрут/параметры изменились — старые цены неактуальны).
export function clearTariffPriceCache() {
  (window as unknown as { __tariffPrices?: Record<string, number> }).__tariffPrices = undefined;
}

// Подставить цену выбранного тарифа в кнопку и order_price БЕЗ пересчёта.
// Возвращает true, если цена нашлась в кэше.
export function applySelectedTariffFromCache(tariff: string): boolean {
  const cache = (window as unknown as { __tariffPrices?: Record<string, number> }).__tariffPrices;
  const cost = cache?.[tariff];
  if (typeof cost !== "number" || cost <= 0) return false;
  const btn = document.querySelector<HTMLElement>(".calc__form__submit, form.uc-tariffCalc button[type=submit]");
  if (btn) btn.textContent = new Intl.NumberFormat("ru-RU").format(cost) + " \u0440\u0443\u0431. \u0417\u0430\u043A\u0430\u0437\u0430\u0442\u044C";
  const orderPrice = document.querySelector<HTMLInputElement>("input[name=order_price]");
  if (orderPrice) orderPrice.value = String(cost);
  return true;
}

// Делаем линию маршрута ярче. Скрипт рисует её тускло, менять его нельзя,
// поэтому подкрашиваем сам SVG-path карты: линия маршрута — самый «длинный»
// path (большая длина атрибута d), мелкие иконки не трогаем.
function brightenRouteLine() {
  const map = document.getElementById("map");
  if (!map) return;
  const paths = Array.from(map.querySelectorAll<SVGPathElement>("path[stroke]"));
  paths.forEach((p) => {
    const d = p.getAttribute("d") || "";
    if (d.length < 200) return; // короткие path — это иконки/маркеры, пропускаем
    p.setAttribute("stroke", "#ffd21a");
    p.setAttribute("stroke-width", "6");
    p.setAttribute("stroke-opacity", "1");
    p.style.filter = "drop-shadow(0 0 3px rgba(255,179,0,0.6))";
  });
}

// Линия дорисовывается асинхронно — красим несколько раз и следим за изменениями DOM карты.
function watchRouteLine() {
  const w = window as unknown as { __routeWatcher?: boolean };
  [200, 600, 1200, 2000].forEach((ms) => setTimeout(brightenRouteLine, ms));
  if (w.__routeWatcher) return;
  const map = document.getElementById("map");
  if (!map) return;
  w.__routeWatcher = true;
  const obs = new MutationObserver(() => {
    window.clearTimeout((watchRouteLine as unknown as { _t?: number })._t);
    (watchRouteLine as unknown as { _t?: number })._t = window.setTimeout(brightenRouteLine, 150);
  });
  obs.observe(map, { childList: true, subtree: true });
}

// Перехватываем ответ расчёта calc_old.php один раз на весь сеанс.
function installCalcInterceptor() {
  const w = window as unknown as { __calcFetchPatched?: boolean };
  if (w.__calcFetchPatched) return;
  w.__calcFetchPatched = true;
  const origFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    const res = await origFetch(input as RequestInfo, init);
    if (url && url.includes("calc_old.php")) {
      res
        .clone()
        .text()
        .then((txt) => {
          try {
            const data = JSON.parse(txt);
            if (data && data.status === "true") {
              applyAllTariffPrices(data.costAllTariff);
              watchRouteLine();
            }
          } catch {
            /* ignore */
          }
        })
        .catch(() => {});
    }
    return res;
  };
}

export default function useTariffCalc(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    installCalcInterceptor();

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

            // Подсказки адресов НЕ зависят от Яндекс.Карт (используют свой
            // серверный ключ), поэтому запускаем их сразу, независимо от карты.
            if (typeof w.initTariffAutocomplete === "function") w.initTariffAutocomplete();

            // Карту инициализируем только если библиотека карт реально загрузилась.
            if (w.ymaps && typeof w.ymaps.ready === "function") {
              w.ymaps.ready(() => {
                if (typeof w.initMap === "function") w.initMap();
              });
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