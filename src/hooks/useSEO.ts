import { useEffect } from "react";

interface SEOOptions {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
}

function setMeta(attr: "name" | "property", key: string, content: string) {
  if (!content) return;
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href: string) {
  if (!href) return;
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export default function useSEO({ title, description, canonical, ogImage }: SEOOptions) {
  useEffect(() => {
    const prevTitle = document.title;
    if (title) document.title = title;
    if (description) {
      setMeta("name", "description", description);
      setMeta("property", "og:description", description);
    }
    if (title) {
      setMeta("property", "og:title", title);
    }
    if (ogImage) setMeta("property", "og:image", ogImage);
    setMeta("property", "og:type", "website");

    const url = canonical || (typeof window !== "undefined" ? window.location.href : "");
    if (url) {
      setCanonical(url);
      setMeta("property", "og:url", url);
    }

    return () => {
      document.title = prevTitle;
    };
  }, [title, description, canonical, ogImage]);
}
