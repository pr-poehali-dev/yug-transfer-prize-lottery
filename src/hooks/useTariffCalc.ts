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

// Достаём число из строки цены ("7 939 ₽" -> 7939).
function parsePrice(text: string): number {
  const digits = (text || "").replace(/[^0-9]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

// Подставить цену выбранного тарифа в кнопку и order_price БЕЗ пересчёта.
// Берём цену из кэша, а если его нет — прямо с карточки тарифа (её уже
// отрисовал скрипт). Возвращает true, если цена найдена.
export function applySelectedTariffFromCache(tariff: string): boolean {
  const cache = (window as unknown as { __tariffPrices?: Record<string, number> }).__tariffPrices;
  let cost = cache?.[tariff] ?? 0;

  if (!cost) {
    const cards = document.querySelectorAll<HTMLElement>(".calc__form__tarif__item");
    cards.forEach((card) => {
      const title = (card.querySelector(".calc__form__tarif__item__title")?.textContent || "").trim();
      if (title === tariff) {
        cost = parsePrice(card.querySelector(".calc__form__tarif__item__price")?.textContent || "");
      }
    });
  }

  if (!cost || cost <= 0) return false;

  const btn = document.querySelector<HTMLElement>(".uc-tariffCalc button[type=submit]");
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
  const paths = Array.from(map.querySelectorAll<SVGPathElement>("path"));
  if (!paths.length) return;

  // Длина атрибута d у линии маршрута сильно больше, чем у иконок/меток.
  // Красим все «длинные» линии, а также самую длинную гарантированно.
  let longest: SVGPathElement | null = null;
  let longestLen = 0;
  const paint = (p: SVGPathElement) => {
    p.setAttribute("stroke", "#ffd21a");
    p.setAttribute("stroke-width", "6");
    p.setAttribute("stroke-opacity", "1");
    p.setAttribute("stroke-linecap", "round");
    p.style.filter = "drop-shadow(0 0 3px rgba(255,179,0,0.7))";
  };

  paths.forEach((p) => {
    const d = (p.getAttribute("d") || "").length;
    if (d > longestLen) {
      longestLen = d;
      longest = p;
    }
    if (d >= 80) paint(p); // длинные пути — это линия(и) маршрута
  });

  if (longest && longestLen >= 40) paint(longest);
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

// Полная очистка формы после успешной отправки заявки.
export function resetOrderForm() {
  const form = document.querySelector<HTMLFormElement>(".uc-tariffCalc form");
  if (!form) return;

  // Текстовые/числовые/дата/время поля и textarea.
  form.querySelectorAll<HTMLInputElement>("input[type=text], input[type=tel], input[type=date], input[type=time], input:not([type]), textarea").forEach((el) => {
    el.value = "";
    el.classList.remove("!border-red-500");
  });
  form.querySelectorAll<HTMLTextAreaElement>("textarea").forEach((el) => (el.value = ""));

  // Чекбоксы (дет. кресло, бустер, животные и пр.).
  form.querySelectorAll<HTMLInputElement>("input[type=checkbox]").forEach((el) => (el.checked = false));
  form.querySelectorAll<HTMLElement>(".calc__form__checkbox__selector.active").forEach((el) => el.classList.remove("active"));

  // Селекты к первому значению.
  form.querySelectorAll<HTMLSelectElement>("select").forEach((el) => (el.selectedIndex = 0));

  // Цены на карточках и кэш.
  document.querySelectorAll<HTMLElement>(".calc__form__tarif__item__price").forEach((el) => (el.textContent = ""));
  document.querySelectorAll<HTMLElement>(".calc__form__tarif__item").forEach((el) => delete el.dataset.hasPrice);
  clearTariffPriceCache();
  const orderPrice = document.querySelector<HTMLInputElement>("input[name=order_price]");
  if (orderPrice) orderPrice.value = "";

  // Очистка карты (маршрут).
  const map = document.getElementById("map");
  if (map) {
    const w = window as unknown as { myMap?: { geoObjects?: { removeAll?: () => void } } };
    try {
      w.myMap?.geoObjects?.removeAll?.();
    } catch {
      /* ignore */
    }
  }

  // Сообщаем React-компоненту сбросить активный тариф и вернуть кнопку.
  window.dispatchEvent(new CustomEvent("orderFormReset"));
}

// Текущая выбранная цена (из кнопки/поля order_price) для отправки в заявке.
function currentSelectedPrice(): number {
  const orderPrice = document.querySelector<HTMLInputElement>("input[name=order_price]");
  if (orderPrice && orderPrice.value) {
    const n = parseInt(orderPrice.value.replace(/[^0-9]/g, ""), 10);
    if (n > 0) return n;
  }
  const btn = document.querySelector<HTMLElement>(".uc-tariffCalc button[type=submit]");
  return parsePrice(btn?.textContent || "");
}

// Дописываем цену выбранного тарифа в FormData заявки (order-create.php).
function appendPriceToFormData(fd: FormData) {
  const price = currentSelectedPrice();
  if (!price) return;
  const tarif = document.querySelector<HTMLSelectElement>("select[name=tarif]")?.value || "";
  const formatted = new Intl.NumberFormat("ru-RU").format(price) + " \u20BD";
  // Разные возможные имена — чтобы сумма точно попала в заявку менеджеру.
  fd.set("orderPrice", String(price));
  fd.set("orderCost", String(price));
  fd.set("orderSumm", formatted);
  fd.set("price", String(price));
  if (tarif) fd.set("orderComment", ((fd.get("orderComment") as string) || "") + ` [Тариф: ${tarif}, цена: ${formatted}]`);
}

// Перехватываем ответ расчёта calc_old.php и отправку заявки (XHR) один раз.
function installCalcInterceptor() {
  const w = window as unknown as { __calcFetchPatched?: boolean };
  if (w.__calcFetchPatched) return;
  w.__calcFetchPatched = true;

  // Патчим XMLHttpRequest.send: скрипт шлёт заявку через jQuery.ajax (XHR).
  // Если это POST на order-create.php с FormData — дописываем цену.
  const XHR = XMLHttpRequest.prototype;
  const origOpen = XHR.open;
  const origSend = XHR.send;
  XHR.open = function (this: XMLHttpRequest & { __url?: string }, method: string, url: string, ...rest: unknown[]) {
    this.__url = url;
    // @ts-expect-error проксируем оригинальную сигнатуру
    return origOpen.call(this, method, url, ...rest);
  };
  XHR.send = function (this: XMLHttpRequest & { __url?: string }, body?: Document | XMLHttpRequestBodyInit | null) {
    try {
      if (this.__url && this.__url.includes("order-create.php") && body instanceof FormData) {
        appendPriceToFormData(body);
        // После успешной отправки — очищаем все поля формы.
        this.addEventListener("load", () => {
          if (this.status >= 200 && this.status < 300) {
            setTimeout(resetOrderForm, 100);
          }
        });
      }
    } catch {
      /* ignore */
    }
    return origSend.call(this, body as XMLHttpRequestBodyInit);
  };

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