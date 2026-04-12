import { useState, useEffect } from "react";

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    active: { label: "Активен", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    ended: { label: "Завершён", color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
    upcoming: { label: "Скоро", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  };
  const s = map[status] || map.ended;
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${s.color}`}>
      {s.label}
    </span>
  );
}

export function CountdownTimer({ endDate }: { endDate: string }) {
  const [time, setTime] = useState({ d: 0, h: 0, m: 0, s: 0 });

  useEffect(() => {
    const update = () => {
      const diff = new Date(endDate).getTime() - Date.now();
      if (diff <= 0) return;
      setTime({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [endDate]);

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="flex gap-1.5 items-center">
      {[{ v: time.d, l: "д" }, { v: time.h, l: "ч" }, { v: time.m, l: "м" }, { v: time.s, l: "с" }].map(({ v, l }) => (
        <div key={l} className="flex flex-col items-center">
          <span className="font-oswald text-lg font-bold text-white leading-none">{pad(v)}</span>
          <span className="text-[9px] text-muted-foreground">{l}</span>
        </div>
      ))}
    </div>
  );
}
