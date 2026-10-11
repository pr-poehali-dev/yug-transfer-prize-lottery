import Icon from "@/components/ui/icon";

export function GroupsBadge({ groups, className = "" }: { groups?: string[] | null; className?: string }) {
  const list = (groups || []).filter(Boolean);
  if (!list.length) return null;
  return (
    <div className={`flex items-center gap-1 min-w-0 text-[10px] text-violet-200 ${className}`} title={`Состоит в группах:\n${list.join("\n")}`}>
      <Icon name="Users" size={11} className="shrink-0 text-violet-300" />
      <span className="truncate">{list[0]}</span>
      {list.length > 1 && <span className="shrink-0 rounded-full bg-violet-500/20 px-1.5">+{list.length - 1}</span>}
    </div>
  );
}

export default GroupsBadge;
