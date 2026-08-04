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
  // Скрипт для одного маршрута шлёт НЕСКОЛЬКО параллельных расчётов (Яндекс
  // отдаёт до 3 альтернативных маршрутов разной длины). Ответы приходят
  // вразнобой, и без фиксации цена «прыгает» — какой ответ пришёл последним.
  // Иногда маршрут по дорогам не строится (нет линии на карте) и длина
  // считается по прямой — цена сильно завышена. Стабилизируем: в рамках одной
  // серии расчёта (до смены маршрута) держим по каждому тарифу МИНИМАЛЬНУЮ
  // цену = реальный маршрут по дорогам, а не завышенный вариант «по прямой».
  // Серию сбрасывает clearTariffPriceCache().
  const win = window as unknown as { __tariffPrices?: Record<string, number> };
  const prev = win.__tariffPrices || {};
  const merged: Record<string, number> = { ...prev };
  Object.keys(costAll).forEach((k) => {
    const v = costAll[k];
    if (typeof v === "number" && v > 0) {
      const cur = merged[k];
      merged[k] = cur && cur > 0 ? Math.min(cur, v) : v;
    }
  });
  // Кэшируем цены всех тарифов, чтобы при клике подставлять без пересчёта.
  win.__tariffPrices = merged;
  const cards = document.querySelectorAll<HTMLElement>(".calc__form__tarif__item");
  cards.forEach((card) => {
    const title = (card.querySelector(".calc__form__tarif__item__title")?.textContent || "").trim();
    const priceEl = card.querySelector<HTMLElement>(".calc__form__tarif__item__price");
    if (!priceEl) return;
    const cost = merged[title];
    if (typeof cost === "number" && cost > 0) {
      priceEl.textContent = new Intl.NumberFormat("ru-RU").format(cost) + " \u20BD";
      card.dataset.hasPrice = "1";
    }
  });
  // Цены пересчитались — просим компонент пересинхронизировать кнопку с
  // текущим выбранным тарифом (иначе скрипт оставит цену своего тарифа).
  window.dispatchEvent(new CustomEvent("tariffPricesUpdated"));
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

  // Очистка карты (маршрут). Функция clearRoutes у скрипта глобальна и
  // очищает geoObjects карты через своё замыкание.
  const w = window as unknown as {
    clearRoutes?: () => void;
    myMap?: { geoObjects?: { removeAll?: () => void } };
  };
  try {
    if (typeof w.clearRoutes === "function") w.clearRoutes();
    else w.myMap?.geoObjects?.removeAll?.();
  } catch {
    /* ignore */
  }

  // Сообщаем React-компоненту сбросить активный тариф и вернуть кнопку.
  window.dispatchEvent(new CustomEvent("orderFormReset"));
}

// Текущая выбранная цена. Приоритет — цена активной карточки тарифа
// (именно её видит пользователь), затем скрытое поле, затем кнопка.
function currentSelectedPrice(): number {
  const activeCard = document.querySelector<HTMLElement>(".calc__form__tarif__item.is-active .calc__form__tarif__item__price");
  const fromCard = parsePrice(activeCard?.textContent || "");
  if (fromCard > 0) return fromCard;

  const orderPrice = document.querySelector<HTMLInputElement>("input[name=order_price]");
  const fromField = parsePrice(orderPrice?.value || "");
  if (fromField > 0) return fromField;

  const btn = document.querySelector<HTMLElement>(".uc-tariffCalc button[type=submit]");
  return parsePrice(btn?.textContent || "");
}

// Синхронно записать цену выбранного тарифа в поле order_price ПЕРЕД отправкой,
// чтобы штатный скрипт прочитал её и добавил в заявку (orderPrice).
export function syncOrderPriceField() {
  const price = currentSelectedPrice();
  const field = document.querySelector<HTMLInputElement>("input[name=order_price]");
  if (field && price > 0) field.value = String(price);
}

// Штатное поле заявки — orderPrice (так его читает диспетчерская).
// Скрипт добавляет его в FormData только если input[name=order_price] непустой.
// Гарантируем, что цена выбранного тарифа там есть.
function appendPriceToFormData(fd: FormData) {
  const existing = fd.get("orderPrice");
  const hasValid = typeof existing === "string" && parsePrice(existing) > 0;
  if (hasValid) return;
  const price = currentSelectedPrice();
  if (price > 0) fd.set("orderPrice", String(price));
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
        const fieldVal = document.querySelector<HTMLInputElement>("input[name=order_price]")?.value;
        const btnTxt = document.querySelector<HTMLElement>(".uc-tariffCalc button[type=submit]")?.textContent;
        console.log("[ORDER] before append: orderPrice(FormData)=", body.get("orderPrice"), "| field order_price=", fieldVal, "| button=", btnTxt);
        appendPriceToFormData(body);
        console.log("[ORDER] after append: orderPrice(FormData)=", body.get("orderPrice"));
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

// Ключевая проблема: контейнер #map — во весь экран (inset-0), его низ уходит
// ПОД шторку заказа, а скрипт вписывает маршрут в ПОЛНУЮ высоту карты — поэтому
// центр маршрута оказывается под формой.
// Надёжное решение через нативный API Яндекса: берём географические границы
// ВСЕХ объектов карты (маршрут) — myMap.geoObjects.getBounds() — и вписываем их
// сами через myMap.setBounds с большим НИЖНИМ отступом (zoomMargin), равным
// высоте формы + запас. Так маршрут центрируется строго в зоне НАД формой.
// [верх, право, низ, лево].
function fitMapAboveSheet() {
  const map = document.getElementById("map");
  if (!map) return;

  const w = window as unknown as {
    myMap?: {
      geoObjects?: { getBounds?: () => number[][] | null };
      setBounds?: (b: number[][], o?: Record<string, unknown>) => unknown;
      container?: { fitToViewport?: () => void };
      margin?: { setDefaultMargin?: (m: number[]) => void };
    };
  };
  const myMap = w.myMap;
  if (!myMap || typeof myMap.setBounds !== "function") return;

  // Границы маршрута (и всех объектов). Пока маршрута нет — getBounds вернёт null.
  let bounds: number[][] | null = null;
  try {
    bounds = myMap.geoObjects?.getBounds?.() || null;
  } catch {
    bounds = null;
  }
  if (!bounds) return;

  const sheet = document.querySelector<HTMLElement>(".uc-tariffCalc");
  const vh = window.innerHeight;
  // Высота формы (видимая часть шторки над низом экрана).
  const sheetTop = sheet ? Math.round(sheet.getBoundingClientRect().top) : Math.round(vh * 0.55);
  const bottomMargin = Math.max(120, vh - sheetTop + 24); // резерв под форму
  const TOP = 96;  // под шапку (лого/телефон)
  const SIDE = 28; // боковые поля

  try {
    // Официальный механизм «карта под панелью»: margin сдвигает видимый центр
    // карты вверх на высоту формы. setBounds после этого центрирует маршрут
    // именно по свободной зоне над формой.
    myMap.margin?.setDefaultMargin?.([TOP, SIDE, bottomMargin, SIDE]);
    myMap.container?.fitToViewport?.();
    myMap.setBounds(bounds, {
      checkZoomRange: true,
      zoomMargin: [TOP, SIDE, bottomMargin, SIDE],
    });
  } catch {
    /* ignore */
  }
}

// Маршрут появляется/перестраивается асинхронно. Держим его вписанным в зону
// над формой: реагируем на изменения размеров формы/экрана и на изменения DOM
// карты (появление линии маршрута), и переприменяем fit несколько раз.
function keepMapAboveSheet() {
  const w = window as unknown as { __sheetGuardHooked?: boolean };
  if (w.__sheetGuardHooked) return;
  w.__sheetGuardHooked = true;

  [300, 700, 1200, 2000, 3000].forEach((ms) => setTimeout(fitMapAboveSheet, ms));

  const sheet = document.querySelector<HTMLElement>(".uc-tariffCalc");
  if (sheet && typeof ResizeObserver !== "undefined") {
    let t = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(t);
      t = window.setTimeout(fitMapAboveSheet, 120);
    });
    ro.observe(sheet);
  }

  const map = document.getElementById("map");
  if (map && typeof MutationObserver !== "undefined") {
    let mt = 0;
    const mo = new MutationObserver(() => {
      window.clearTimeout(mt);
      mt = window.setTimeout(fitMapAboveSheet, 150);
    });
    mo.observe(map, { childList: true, subtree: true });
  }

  window.addEventListener("resize", () => setTimeout(fitMapAboveSheet, 120));
  window.addEventListener("orientationchange", () => setTimeout(fitMapAboveSheet, 250));
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
                // Держим карту ужатой до верха формы, чтобы маршрут вписывался
                // в видимую часть над шторкой заказа.
                keepMapAboveSheet();
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