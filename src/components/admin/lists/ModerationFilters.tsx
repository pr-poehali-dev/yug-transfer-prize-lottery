import Icon from "@/components/ui/icon";
import { inputCls } from "./listTypes";

export type ModerationFilter = "all" | "new" | "ok" | "miss";

interface Props {
  search: string;
  setSearch: (v: string) => void;
  filter: ModerationFilter;
  setFilter: (v: ModerationFilter) => void;
  counts: { all: number; new: number; ok: number; miss: number };
}

export function ModerationFilters({ search, setSearch, filter, setFilter, counts }: Props) {
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <div className="relative flex-1">
        <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по имени, @username, ID, описанию" className={`${inputCls} pl-9`} />
      </div>
      <div className="flex gap-1 overflow-x-auto">
        {([
          ["all", `Все ${counts.all}`], ["new", `Не проверены ${counts.new}`],
          ["ok", `Найдены ${counts.ok}`], ["miss", `Не найдены ${counts.miss}`],
        ] as const).map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs border ${filter === k
              ? "border-amber-400/60 bg-amber-500/15 text-amber-200" : "border-white/10 text-white/60 hover:bg-white/5"}`}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default ModerationFilters;
