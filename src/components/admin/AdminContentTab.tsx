import { useState } from "react";
import Icon from "@/components/ui/icon";
import { AdminPostsTab } from "./AdminPostsTab";
import { AdminBotTab } from "./AdminBotTab";

type SubTab = "posts" | "bot";

export function AdminContentTab({ token }: { token: string }) {
  const [sub, setSub] = useState<SubTab>("posts");

  const SUBS: { id: SubTab; label: string; icon: string }[] = [
    { id: "posts", label: "Посты в канал", icon: "Send" },
    { id: "bot", label: "Наш бот", icon: "Bot" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
        {SUBS.map(s => (
          <button
            key={s.id}
            onClick={() => setSub(s.id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
              sub === s.id
                ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg"
                : "text-muted-foreground hover:text-white hover:bg-white/5"
            }`}
          >
            <Icon name={s.icon} size={15} fallback="Circle" />
            {s.label}
          </button>
        ))}
      </div>

      {sub === "posts" && <AdminPostsTab token={token} />}
      {sub === "bot" && <AdminBotTab token={token} />}
    </div>
  );
}

export default AdminContentTab;
