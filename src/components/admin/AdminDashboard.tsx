import { useState } from "react";
import Icon from "@/components/ui/icon";
import { AdminTab } from "./adminTypes";
import { AdminPostsTab } from "./AdminPostsTab";
import { AdminBotTab } from "./AdminBotTab";
import { AdminDriversTab } from "./AdminDriversTab";
import { AdminStoriesTab } from "./AdminStoriesTab";
import { AdminExcludedTab } from "./AdminExcludedTab";
import { AdminUgDriverTab } from "./AdminUgDriverTab";

export function AdminDashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [tab, setTab] = useState<AdminTab>("posts");
  const [postsTotal, setPostsTotal] = useState<number | null>(null);

  const TABS: { id: AdminTab; label: string; icon: string; badge?: number | null }[] = [
    { id: "posts", label: "Посты в канал", icon: "Send", badge: postsTotal },
    { id: "drivers", label: "Водители", icon: "Car" },
  ];

  return (
    <div className="min-h-screen mesh-bg">
      <header className="glass border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-3" />
          <div className="flex items-center gap-3">
            <a href="/" className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1.5">
              <Icon name="ExternalLink" size={14} />На сайт
            </a>
            <button onClick={onLogout} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-muted-foreground hover:text-white hover:bg-white/5 transition-all text-sm">
              <Icon name="LogOut" size={15} />Выйти
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 flex gap-6">
        <aside className="hidden md:flex flex-col gap-1 w-52 shrink-0">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${tab === t.id ? "grad-btn shadow-lg" : "text-muted-foreground hover:text-white hover:bg-white/5"}`}>
              <Icon name={t.icon as string} size={17} fallback="Circle" />
              <span className="flex-1 text-left">{t.label}</span>
              {typeof t.badge === "number" && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${tab === t.id ? "bg-white/20 text-white" : "bg-white/10 text-white/60"}`}>{t.badge}</span>
              )}
            </button>
          ))}
        </aside>

        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/5 flex">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors relative ${tab === t.id ? "text-purple-400" : "text-muted-foreground"}`}>
              <div className="relative">
                <Icon name={t.icon as string} size={18} fallback="Circle" />
                {typeof t.badge === "number" && t.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 text-[9px] font-bold px-1 min-w-[14px] h-[14px] rounded-full bg-purple-500 text-white flex items-center justify-center">{t.badge}</span>
                )}
              </div>
              {t.label}
            </button>
          ))}
        </div>

        <main className="flex-1 min-w-0 pb-20 md:pb-0">
          {tab === "posts" && (
            <div className="space-y-3">
              <AdminPostsTab token={token} onTotalChange={setPostsTotal} />
              <AdminBotTab token={token} />
              <AdminStoriesTab token={token} />
              <AdminExcludedTab token={token} />
              <AdminUgDriverTab token={token} />
            </div>
          )}
          {tab === "drivers" && <AdminDriversTab token={token} />}
        </main>
      </div>
    </div>
  );
}