import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageShell from "@/components/PageShell";
import Icon from "@/components/ui/icon";

const BRIDGE_NEWS_URL = "https://functions.poehali.dev/3af26657-db34-4fcf-9d05-41d0122fbe3b";

interface Post {
  id: string;
  text: string;
  image: string | null;
  date: string | null;
  link: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAgo(ts: number, now: number): string {
  const sec = Math.max(0, Math.floor((now - ts) / 1000));
  if (sec < 10) return "обновлено только что";
  if (sec < 60) return `обновлено ${sec} сек назад`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `обновлено ${min} мин назад`;
  const h = Math.floor(min / 60);
  return `обновлено ${h} ч назад`;
}

export default function BridgePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let active = true;

    const load = () =>
      fetch(`${BRIDGE_NEWS_URL}?t=${Date.now()}`)
        .then((r) => r.json())
        .then((data) => {
          if (!active) return;
          if (data.posts && data.posts.length) {
            setPosts(data.posts);
            setError(false);
            setUpdatedAt(Date.now());
          } else {
            setError(true);
          }
        })
        .catch(() => {
          if (active) setError(true);
        })
        .finally(() => {
          if (active) setLoading(false);
        });

    load();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 60000);

    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(tick);
  }, []);

  return (
    <PageShell title="Крымский Мост" icon="Construction">
      <p className="text-white/70 mb-5 max-w-2xl">
        Оперативная информация о проезде через Крымский мост — обстановка на досмотре, важные новости и правила.
        Данные обновляются автоматически из официального канала.
      </p>

      <Link
        to="/?comment=Трансфер через Крымский мост"
        className="inline-flex items-center gap-2 mb-7 px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold transition-colors"
      >
        <Icon name="Car" size={20} /> Заказать трансфер через Крымский мост
      </Link>

      {loading && (
        <div className="flex items-center gap-2 text-white/60 py-8">
          <Icon name="Loader" size={20} className="animate-spin text-amber-400" />
          Загружаем последние новости…
        </div>
      )}

      {!loading && error && (
        <div className="bg-[#1a1a1a]/95 rounded-2xl border border-white/10 p-6 text-white/70">
          Не удалось загрузить новости. Посмотрите актуальную информацию в{" "}
          <a href="https://t.me/most_official" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">
            официальном канале
          </a>
          .
        </div>
      )}

      {!loading && !error && updatedAt && (
        <div className="flex items-center gap-1.5 text-white/50 text-xs mb-3">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          {formatAgo(updatedAt, now)}
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-4">
          {posts.map((p) => (
            <a
              key={p.id}
              href={p.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-[#1a1a1a]/95 rounded-2xl border border-white/10 overflow-hidden hover:border-amber-500/40 transition-colors"
            >
              {p.image && (
                <img src={p.image} alt="" className="w-full max-h-72 object-cover" loading="lazy" />
              )}
              <div className="p-5">
                {p.date && (
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-medium mb-2">
                    <Icon name="Clock" size={13} />
                    {formatDate(p.date)}
                  </div>
                )}
                <p className="text-white/90 whitespace-pre-line leading-relaxed text-[15px]">{p.text}</p>
                <div className="flex items-center gap-1.5 text-white/40 text-xs mt-3">
                  <Icon name="Send" size={13} />
                  Открыть в Telegram
                </div>
              </div>
            </a>
          ))}
        </div>
      )}

      <Link to="/" className="inline-flex items-center gap-2 mt-7 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold transition-colors">
        <Icon name="Plus" size={18} /> Заказать трансфер
      </Link>
    </PageShell>
  );
}