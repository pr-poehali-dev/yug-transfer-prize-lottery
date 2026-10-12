import Icon from "@/components/ui/icon";

type Props = {
  page: number;
  total: number;
  perPage: number;
  loading?: boolean;
  onChange: (page: number) => void;
};

function pages(cur: number, last: number): (number | "…")[] {
  const set = new Set([1, last, cur - 1, cur, cur + 1].filter((p) => p >= 1 && p <= last));
  const list = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  list.forEach((p, i) => {
    if (i > 0 && p - list[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}

export default function Pager({ page, total, perPage, loading, onChange }: Props) {
  const last = Math.max(1, Math.ceil(total / perPage));
  if (last <= 1) return null;
  const go = (p: number) => {
    if (p < 1 || p > last || p === page || loading) return;
    onChange(p);
  };
  const base = "h-9 min-w-9 px-2 rounded-lg text-sm flex items-center justify-center transition-colors disabled:opacity-30";
  return (
    <div className="flex flex-col items-center gap-1.5 pt-1">
      <div className="flex items-center justify-center gap-1 flex-wrap">
        <button onClick={() => go(page - 1)} disabled={page === 1 || loading} className={`${base} border border-white/10 text-white/70 hover:bg-white/5`}>
          <Icon name="ChevronLeft" size={16} />
        </button>
        {pages(page, last).map((p, i) =>
          p === "…" ? (
            <span key={`d${i}`} className="px-1 text-white/30 text-sm">…</span>
          ) : (
            <button key={p} onClick={() => go(p)} disabled={loading && p !== page}
              className={`${base} ${p === page ? "bg-purple-500/80 text-white font-semibold" : "border border-white/10 text-white/70 hover:bg-white/5"}`}>
              {p}
            </button>
          ),
        )}
        <button onClick={() => go(page + 1)} disabled={page === last || loading} className={`${base} border border-white/10 text-white/70 hover:bg-white/5`}>
          <Icon name="ChevronRight" size={16} />
        </button>
      </div>
      <div className="text-[11px] text-white/35 flex items-center gap-1.5">
        {loading && <Icon name="Loader2" size={11} className="animate-spin" />}
        Страница {page} из {last} · всего {total}
      </div>
    </div>
  );
}
