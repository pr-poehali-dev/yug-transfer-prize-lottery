import { useCallback, useEffect, useRef, useState } from "react";

// Расчёт стоимости поездки БЕЗ Яндекс.Карт:
//   1. адрес -> координаты   (Nominatim / OpenStreetMap, без ключа)
//   2. координаты -> км      (OSRM, без ключа)
//   3. км -> цена по тарифам (calc_old.php на сервере vse-zakazy.ru)

const CALC_URL =
  "https://vse-zakazy.ru/wp-content/themes/ug-transfer-operator/tariffCalc/calc_old.php";

export type PriceState = {
  loading: boolean;
  distanceKm: number | null;
  tariffs: Record<string, number> | null;
  error: string | null;
};

type Coord = [number, number]; // [lon, lat]

const geoCache = new Map<string, Coord | null>();

async function geocode(address: string): Promise<Coord | null> {
  const key = address.trim().toLowerCase();
  if (geoCache.has(key)) return geoCache.get(key)!;
  const url =
    "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ru&q=" +
    encodeURIComponent(address);
  const res = await fetch(url, { headers: { "Accept-Language": "ru" } });
  const data = (await res.json()) as Array<{ lon: string; lat: string }>;
  const coord: Coord | null =
    data && data.length > 0 ? [parseFloat(data[0].lon), parseFloat(data[0].lat)] : null;
  geoCache.set(key, coord);
  return coord;
}

async function routeKm(points: Coord[]): Promise<number> {
  const path = points.map((p) => `${p[0]},${p[1]}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${path}?overview=false`;
  const res = await fetch(url);
  const data = (await res.json()) as { routes?: Array<{ distance: number }> };
  if (!data.routes || data.routes.length === 0) throw new Error("route not found");
  return data.routes[0].distance / 1000;
}

export type CalcParams = {
  start: string;
  end: string;
  stops?: string[];
  babyChair?: boolean;
  buster?: boolean;
  pet?: boolean;
};

export default function usePriceCalc() {
  const [state, setState] = useState<PriceState>({
    loading: false,
    distanceKm: null,
    tariffs: null,
    error: null,
  });
  const tokenRef = useRef(0);

  const calc = useCallback(async (p: CalcParams) => {
    const start = p.start.trim();
    const end = p.end.trim();
    if (start.length <= 2 || end.length <= 2) {
      setState({ loading: false, distanceKm: null, tariffs: null, error: null });
      return;
    }
    const token = ++tokenRef.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const stops = (p.stops || []).filter((s) => s.trim().length > 2);
      const addresses = [start, ...stops, end];
      const coords = await Promise.all(addresses.map(geocode));
      if (token !== tokenRef.current) return;
      if (coords.some((c) => c === null)) {
        setState({
          loading: false,
          distanceKm: null,
          tariffs: null,
          error: "Не удалось определить адрес",
        });
        return;
      }
      const points = coords as Coord[];
      const km = await routeKm(points);
      if (token !== tokenRef.current) return;

      const body = {
        route: points,
        length_km: km.toFixed(2),
        start,
        end,
        waypoints: stops,
        additional: stops.join("|"),
        tarif: "1",
        orderBabyChair: p.babyChair ? "true" : "false",
        orderBuster: p.buster ? "true" : "false",
        orderPet: p.pet ? "true" : "false",
        CardPayCash: "true",
        CardPayTransfer: "false",
        CardPayNubmerCard: "false",
        paymentMethod: "Наличные",
      };
      const res = await fetch(CALC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await res.json()) as {
        status: string;
        fullDistance?: number;
        costAllTariff?: Record<string, number>;
      };
      if (token !== tokenRef.current) return;
      if (result.status === "true" && result.costAllTariff) {
        setState({
          loading: false,
          distanceKm: result.fullDistance ?? Math.round(km),
          tariffs: result.costAllTariff,
          error: null,
        });
      } else {
        setState({
          loading: false,
          distanceKm: null,
          tariffs: null,
          error: "Не удалось рассчитать стоимость",
        });
      }
    } catch {
      if (token !== tokenRef.current) return;
      setState({
        loading: false,
        distanceKm: null,
        tariffs: null,
        error: "Ошибка расчёта, попробуйте позже",
      });
    }
  }, []);

  const reset = useCallback(() => {
    tokenRef.current++;
    setState({ loading: false, distanceKm: null, tariffs: null, error: null });
  }, []);

  return { ...state, calc, reset };
}

// Хелпер: дебаунс-обёртка для авторасчёта при вводе.
export function useDebouncedEffect(fn: () => void, deps: unknown[], delay: number) {
  useEffect(() => {
    const id = setTimeout(fn, delay);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delay]);
}
