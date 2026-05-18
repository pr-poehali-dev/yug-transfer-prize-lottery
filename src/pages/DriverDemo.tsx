import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ROUTES = [
  {
    color: "#f97316",
    waypoints: [
      [44.4951, 34.1664],
      [44.5022, 34.1822],
      [44.5085, 34.1671],
      [44.4974, 34.1543],
      [44.4951, 34.1664],
    ],
  },
  {
    color: "#22c55e",
    waypoints: [
      [44.5106, 34.1502],
      [44.5198, 34.1738],
      [44.5054, 34.1900],
      [44.4960, 34.1721],
      [44.5106, 34.1502],
    ],
  },
  {
    color: "#3b82f6",
    waypoints: [
      [44.4870, 34.1430],
      [44.4912, 34.1685],
      [44.4830, 34.1820],
      [44.4750, 34.1612],
      [44.4870, 34.1430],
    ],
  },
  {
    color: "#a855f7",
    waypoints: [
      [44.5240, 34.1980],
      [44.5150, 34.2130],
      [44.5012, 34.2060],
      [44.5095, 34.1880],
      [44.5240, 34.1980],
    ],
  },
  {
    color: "#f97316",
    waypoints: [
      [44.4690, 34.1290],
      [44.4790, 34.1175],
      [44.4865, 34.1340],
      [44.4775, 34.1430],
      [44.4690, 34.1290],
    ],
  },
];

const carIcon = (color: string) =>
  L.divIcon({
    className: "",
    html: `
      <div style="position:relative;width:40px;height:40px;transform:translate(-50%,-50%);">
        <div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:.3;animation:pulse-ring 2s ease-out infinite;"></div>
        <div style="position:relative;width:40px;height:40px;border-radius:50%;background:white;border:2px solid ${color};box-shadow:0 4px 12px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:22px;line-height:1;">
          🚕
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

async function fetchOSRMRoute(points: number[][]): Promise<[number, number][]> {
  const coords = points.map((p) => `${p[1]},${p[0]}`).join(";");
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`,
    );
    const data = await res.json();
    if (data.routes?.[0]?.geometry?.coordinates) {
      return data.routes[0].geometry.coordinates.map(
        (c: [number, number]) => [c[1], c[0]] as [number, number],
      );
    }
  } catch (e) {
    console.error("OSRM error", e);
  }
  return points.map((p) => [p[0], p[1]] as [number, number]);
}

const DriverDemo = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [driversCount, setDriversCount] = useState(27);

  useEffect(() => {
    const interval = setInterval(() => {
      setDriversCount((prev) => {
        const delta = Math.floor(Math.random() * 5) - 2;
        const next = prev + delta;
        if (next < 22) return 22;
        if (next > 34) return 34;
        return next;
      });
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [44.4951, 34.1664],
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });
    mapInstanceRef.current = map;

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      { maxZoom: 19, subdomains: "abcd" },
    ).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    const animations: number[] = [];

    ROUTES.forEach(async (route, idx) => {
      const path = await fetchOSRMRoute(route.waypoints);
      if (path.length < 2) return;

      L.polyline(path, {
        color: route.color,
        weight: 3,
        opacity: 0.35,
        dashArray: "6, 8",
      }).addTo(map);

      const marker = L.marker(path[0], { icon: carIcon(route.color) }).addTo(map);

      const speed = 0.00015 + idx * 0.00003;
      let i = 0;
      let progress = 0;

      const step = () => {
        if (i >= path.length - 1) i = 0;
        const [lat1, lng1] = path[i];
        const [lat2, lng2] = path[i + 1];
        const lat = lat1 + (lat2 - lat1) * progress;
        const lng = lng1 + (lng2 - lng1) * progress;
        marker.setLatLng([lat, lng]);

        progress += speed * 100;
        if (progress >= 1) {
          progress = 0;
          i++;
        }
        animations.push(requestAnimationFrame(step));
      };
      step();
    });

    return () => {
      animations.forEach((id) => cancelAnimationFrame(id));
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  return (
    <div className="h-screen overflow-hidden bg-zinc-950 text-white relative">
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.6); opacity: 0.8; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        .leaflet-container { background: #1a1a1a; }
      `}</style>

      <div ref={mapRef} className="absolute inset-0 w-full h-full z-0" />

      <header className="absolute top-4 left-4 right-4 z-20">
        <div className="max-w-[1600px] mx-auto bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-full px-6 py-3 flex items-center justify-between shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center font-bold text-sm">
              ЮГ
            </div>
            <span className="font-bold tracking-wider text-sm hidden sm:block">
              ЮГ-ТРАНСФЕР
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm">
            <a className="text-orange-400 border-b-2 border-orange-400 pb-1" href="#">
              Главная
            </a>
            <a className="flex items-center gap-1 hover:text-orange-400 transition" href="#">
              Клиенту <Icon name="ChevronDown" size={14} />
            </a>
            <a className="flex items-center gap-1 hover:text-orange-400 transition" href="#">
              Водителю <Icon name="ChevronDown" size={14} />
            </a>
            <a className="hover:text-orange-400 transition" href="#">
              Контакты
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden md:block text-xs font-semibold tracking-wider">
              ВЛАДИМИР ХОМЕНКО
            </span>
            <div className="w-10 h-10 rounded-full bg-zinc-700 border-2 border-orange-400 overflow-hidden">
              <div className="w-full h-full bg-gradient-to-br from-zinc-600 to-zinc-800" />
            </div>
          </div>
        </div>
      </header>

      <aside className="absolute top-[112px] left-4 bottom-4 z-10 w-[440px] bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-2xl p-4 shadow-2xl flex flex-col">
        <div className="mb-3 text-center">
          <h1 className="text-lg font-bold leading-tight">Закажите трансфер</h1>
        </div>

        <div className="space-y-2 flex-1 flex flex-col min-h-0">
          <div className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 focus-within:border-orange-400 transition">
            <Label className="text-[10px] text-zinc-400 block leading-tight">Откуда?</Label>
            <Input
              defaultValue="Ялта, ул. Кирова, 12"
              className="bg-transparent border-0 h-5 p-0 text-white text-xs focus-visible:ring-0"
            />
          </div>

          <button
            type="button"
            className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-orange-400 transition px-1 py-0.5 self-start"
          >
            <Icon name="Plus" size={12} />
            <span>Промежуточный адрес</span>
          </button>

          <div className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 focus-within:border-orange-400 transition">
            <Label className="text-[10px] text-zinc-400 block leading-tight">Куда?</Label>
            <Input
              placeholder="Введите адрес"
              className="bg-transparent border-0 h-5 p-0 text-white text-xs focus-visible:ring-0 placeholder:text-zinc-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 focus-within:border-orange-400 transition">
              <Label className="text-[10px] text-zinc-400 block leading-tight">Имя</Label>
              <Input
                defaultValue="Владимир"
                className="bg-transparent border-0 h-5 p-0 text-white text-xs focus-visible:ring-0"
              />
            </div>
            <div className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 focus-within:border-orange-400 transition">
              <Label className="text-[10px] text-zinc-400 block leading-tight">Телефон</Label>
              <Input
                defaultValue="+7 (984) 334-87-24"
                className="bg-transparent border-0 h-5 p-0 text-white text-xs focus-visible:ring-0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 focus-within:border-orange-400 transition">
              <Label className="text-[10px] text-zinc-400 block leading-tight">Дата</Label>
              <Input
                type="date"
                defaultValue="2026-05-17"
                className="bg-transparent border-0 h-5 p-0 text-white text-xs focus-visible:ring-0 [color-scheme:dark]"
              />
            </div>
            <div className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 focus-within:border-orange-400 transition">
              <Label className="text-[10px] text-zinc-400 block leading-tight">Время</Label>
              <Input
                type="time"
                defaultValue="22:46"
                className="bg-transparent border-0 h-5 p-0 text-white text-xs focus-visible:ring-0 [color-scheme:dark]"
              />
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <Label className="text-[10px] text-zinc-400 mb-1.5 block px-0.5">
              Выберите тариф
            </Label>
            <div className="grid grid-cols-3 grid-rows-2 gap-1.5 flex-1 min-h-0">
              {[
                { icon: "Zap", name: "Срочный", price: "от 2 500 ₽", active: true },
                { icon: "Car", name: "Стандарт", price: "от 1 800 ₽" },
                { icon: "CarFront", name: "Комфорт", price: "от 2 200 ₽" },
                { icon: "Bus", name: "Минивэн", price: "от 3 500 ₽" },
                { icon: "Crown", name: "Бизнес", price: "от 5 000 ₽" },
                { icon: "Package", name: "Доставка", price: "от 500 ₽" },
              ].map((t) => (
                <button
                  key={t.name}
                  type="button"
                  className={`rounded-lg p-2 text-left transition border flex flex-col justify-center min-h-0 ${
                    t.active
                      ? "bg-orange-500/15 border-orange-400"
                      : "bg-zinc-950 border-zinc-700 hover:border-zinc-500"
                  }`}
                >
                  <Icon
                    name={t.icon}
                    size={16}
                    className={`mb-1 ${t.active ? "text-orange-400" : "text-zinc-400"}`}
                  />
                  <div className="text-xs font-semibold leading-tight truncate">{t.name}</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5 truncate">{t.price}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            <button className="w-10 h-10 bg-zinc-950 border border-zinc-700 rounded-lg flex items-center justify-center hover:border-orange-400 transition flex-shrink-0">
              <Icon name="Wallet" size={15} className="text-zinc-400" />
            </button>
            <Button className="flex-1 h-10 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg text-sm">
              <Icon name="Send" size={15} className="mr-1.5" />
              Заказать трансфер
            </Button>
            <button className="w-10 h-10 bg-zinc-950 border border-zinc-700 rounded-lg flex items-center justify-center hover:border-orange-400 transition flex-shrink-0">
              <Icon name="SlidersHorizontal" size={15} className="text-zinc-400" />
            </button>
          </div>

          <p className="text-[10px] text-zinc-500 text-center">
            Нажимая кнопку, вы соглашаетесь с обработкой данных
          </p>
        </div>
      </aside>

      <div className="absolute top-[112px] right-4 z-10 bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-xl px-3 py-2 flex items-center gap-2 text-xs shadow-lg">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span>
          Доступно <b className="tabular-nums">{driversCount} водителей</b> рядом
        </span>
      </div>

      <div className="absolute bottom-4 right-4 z-10 bg-zinc-900/95 backdrop-blur border border-zinc-800 rounded-2xl p-4 max-w-[290px] shadow-2xl">
        <div className="text-base font-bold mb-1">+7 (984) 334-87-24</div>
        <div className="text-[11px] text-zinc-400 mb-2.5">
          Закажите по телефону или в мессенджере
        </div>
        <div className="flex gap-2">
          <a className="w-9 h-9 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center transition cursor-pointer">
            <Icon name="Send" size={15} />
          </a>
          <a className="w-9 h-9 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center transition cursor-pointer">
            <Icon name="MessageCircle" size={15} />
          </a>
          <a className="w-9 h-9 bg-purple-500 hover:bg-purple-600 rounded-full flex items-center justify-center transition cursor-pointer">
            <Icon name="Phone" size={15} />
          </a>
        </div>
      </div>

      <div className="absolute bottom-4 left-[460px] right-[310px] z-10 hidden xl:grid grid-cols-4 gap-2">
        {[
          { icon: "Clock", title: "Подача 10 мин" },
          { icon: "MapPin", title: "По всей России" },
          { icon: "Shield", title: "Безопасность" },
          { icon: "Wallet", title: "Фикс. цена" },
        ].map((f) => (
          <div
            key={f.title}
            className="bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-xl px-3 py-2 flex gap-2 items-center shadow-lg"
          >
            <Icon name={f.icon} size={16} className="text-orange-400 flex-shrink-0" />
            <div className="text-xs font-semibold truncate">{f.title}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DriverDemo;