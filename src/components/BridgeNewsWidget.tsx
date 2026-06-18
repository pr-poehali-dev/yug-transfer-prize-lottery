import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "@/components/ui/icon";

const BRIDGE_NEWS_URL = "https://functions.poehali.dev/3af26657-db34-4fcf-9d05-41d0122fbe3b";

interface Post {
  id: string;
  text: string;
  date: string | null;
  link: string;
}

function timeOnly(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function BridgeNewsWidget() {
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetch(`${BRIDGE_NEWS_URL}?t=${Date.now()}`)
        .then((r) => r.json())
        .then((data) => {
          if (active && data.posts && data.posts.length) setPosts(data.posts.slice(0, 2));
        })
        .catch(() => {});
    load();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 60000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  if (!posts.length) return null;

  return (
    <Link
      to="/bridge"
      className="block bg-[#1a1a1a]/95 backdrop-blur rounded-xl border border-white/10 shadow-2xl p-3 hover:border-amber-500/40 transition-colors"
    >
      <div className="flex items-center gap-1.5 mb-2">
        <Icon name="Construction" size={14} className="text-amber-400" />
        <span className="font-bold text-white text-xs">Крымский Мост</span>
        <span className="relative flex h-1.5 w-1.5 ml-0.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
        </span>
        <span className="ml-auto text-amber-400 text-[11px] flex items-center gap-0.5">
          Все <Icon name="ChevronRight" size={12} />
        </span>
      </div>
      <div className="space-y-2">
        {posts.map((p) => (
          <div key={p.id} className="border-b border-white/5 last:border-0 pb-2 last:pb-0">
            {p.date && <div className="text-amber-400/80 text-[10px] mb-0.5">{timeOnly(p.date)}</div>}
            <p className="text-white/85 text-[11px] leading-snug line-clamp-2">{p.text}</p>
          </div>
        ))}
      </div>
    </Link>
  );
}