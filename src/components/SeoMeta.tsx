import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SITE = "https://moy-transfer.ru";

const NOINDEX_PREFIXES = ["/admin", "/posts", "/cabinet", "/dispatch", "/tg-search"];

const PUBLIC_PATHS = [
  "/",
  "/privacy",
  "/offer",
  "/directions",
  "/tariffs",
  "/contacts",
  "/bridge",
];

function setTag(rel: "canonical", href: string) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

function setRobots(content: string | null) {
  let el = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (!content) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("meta");
    el.name = "robots";
    document.head.appendChild(el);
  }
  el.content = content;
}

function isKnownPath(path: string) {
  if (PUBLIC_PATHS.includes(path)) return true;
  if (/^\/route\/[^/]+$/.test(path)) return true;
  if (/^\/tariff\/[^/]+$/.test(path)) return true;
  return NOINDEX_PREFIXES.some((p) => path.startsWith(p));
}

export function SeoMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    const clean = pathname !== "/" ? pathname.replace(/\/+$/, "") : "/";
    const hidden = NOINDEX_PREFIXES.some((p) => clean.startsWith(p));
    const unknown = !isKnownPath(clean);

    setTag("canonical", `${SITE}${clean === "/" ? "/" : clean}`);
    setRobots(hidden || unknown ? "noindex, nofollow" : null);
  }, [pathname]);

  return null;
}

export default SeoMeta;
