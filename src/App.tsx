
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense, type ComponentType } from "react";

// Устойчивая ленивая загрузка страниц. Иногда браузер не может подгрузить
// модуль страницы (обрыв сети, обновившийся деплой, устаревший кэш) — тогда
// падает "Failed to fetch dynamically imported module" и появляется белый
// экран. В этом случае один раз перезагружаем страницу (защита от цикла через
// sessionStorage), чтобы подтянуть свежие файлы.
function lazyWithReload<T extends ComponentType<unknown>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem("chunk-reloaded");
      return mod;
    } catch (e) {
      if (!sessionStorage.getItem("chunk-reloaded")) {
        sessionStorage.setItem("chunk-reloaded", "1");
        window.location.reload();
        // Возвращаем пустышку, пока идёт перезагрузка.
        return { default: (() => null) as unknown as T };
      }
      throw e;
    }
  });
}

const Index = lazyWithReload(() => import("./pages/Index"));
const Posts = lazyWithReload(() => import("./pages/Posts"));
const Privacy = lazyWithReload(() => import("./pages/Privacy"));
const Offer = lazyWithReload(() => import("./pages/Offer"));
const Directions = lazyWithReload(() => import("./pages/RoutesPage"));
const RouteDetail = lazyWithReload(() => import("./pages/RouteDetailPage"));
const Tariffs = lazyWithReload(() => import("./pages/TariffsPage"));
const TariffDetail = lazyWithReload(() => import("./pages/TariffDetailPage"));
const Contacts = lazyWithReload(() => import("./pages/ContactsPage"));
const Bridge = lazyWithReload(() => import("./pages/BridgePage"));
const NotFound = lazyWithReload(() => import("./pages/NotFound"));

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/admin" element={<Posts />} />
          <Route path="/posts" element={<Posts />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/offer" element={<Offer />} />
          <Route path="/directions" element={<Directions />} />
          <Route path="/route/:slug" element={<RouteDetail />} />
          <Route path="/tariffs" element={<Tariffs />} />
          <Route path="/tariff/:slug" element={<TariffDetail />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/bridge" element={<Bridge />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;