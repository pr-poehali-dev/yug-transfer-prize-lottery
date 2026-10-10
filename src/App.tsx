
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense, type ComponentType } from "react";
import SeoMeta from "@/components/SeoMeta";

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
const TgSearch = lazyWithReload(() => import("./pages/TgSearch"));
const NotFound = lazyWithReload(() => import("./pages/NotFound"));

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <SeoMeta />
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/admin" element={<Posts />} />
          <Route path="/posts" element={<Posts />} />
          <Route path="/tg-search" element={<TgSearch />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;