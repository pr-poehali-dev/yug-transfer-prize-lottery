import { useEffect, useRef, useState } from "react";

type Suggestion = { label: string; short: string };

const cache = new Map<string, Suggestion[]>();

async function fetchSuggestions(query: string): Promise<Suggestion[]> {
  const key = query.trim().toLowerCase();
  if (key.length < 3) return [];
  if (cache.has(key)) return cache.get(key)!;
  const url =
    "https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=ru&addressdetails=1&q=" +
    encodeURIComponent(query);
  try {
    const res = await fetch(url, { headers: { "Accept-Language": "ru" } });
    const data = (await res.json()) as Array<{
      display_name: string;
      address?: Record<string, string>;
    }>;
    const list = data.map((x) => {
      const a = x.address || {};
      const parts = [
        a.road || a.pedestrian || a.suburb || a.neighbourhood,
        a.house_number,
        a.city || a.town || a.village || a.municipality,
      ].filter(Boolean);
      const short = parts.length ? parts.join(", ") : x.display_name.split(",").slice(0, 3).join(",");
      return { label: x.display_name, short };
    });
    cache.set(key, list);
    return list;
  } catch {
    return [];
  }
}

type Props = {
  name: string;
  placeholder: string;
  defaultValue?: string;
  className?: string;
  onChangeValue?: (v: string) => void;
};

export default function AddressInput({
  name,
  placeholder,
  defaultValue = "",
  className,
  onChangeValue,
}: Props) {
  const [value, setValue] = useState(defaultValue);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef(false);

  useEffect(() => {
    if (skipRef.current) {
      skipRef.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 3) {
      setItems([]);
      return;
    }
    const id = setTimeout(async () => {
      const list = await fetchSuggestions(q);
      setItems(list);
      setOpen(list.length > 0);
    }, 350);
    return () => clearTimeout(id);
  }, [value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const pick = (s: Suggestion) => {
    skipRef.current = true;
    setValue(s.short);
    onChangeValue?.(s.short);
    setOpen(false);
    setItems([]);
  };

  return (
    <div ref={boxRef} className="relative">
      <input
        name={name}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
        onChange={(e) => {
          setValue(e.target.value);
          onChangeValue?.(e.target.value);
        }}
        onFocus={() => items.length > 0 && setOpen(true)}
      />
      {open && items.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-lg border border-white/15 bg-[#1a1a1a] shadow-2xl">
          {items.map((s, i) => (
            <li
              key={i}
              className="px-3 py-2 text-sm text-white/90 hover:bg-amber-500/20 cursor-pointer border-b border-white/5 last:border-0"
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s);
              }}
            >
              {s.short}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
