import { useState } from "react";
import Icon from "@/components/ui/icon";
import { AdminPostsTab } from "./AdminPostsTab";
import { AdminBotTab } from "./AdminBotTab";
import { AdminStoriesTab } from "./AdminStoriesTab";

export function PostsDashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [, setPostsTotal] = useState<number | null>(null);
  type Section = "posts" | "bot" | "stories";
  const [openSection, setOpenSection] = useState<Section | null>("posts");
  const toggleSection = (s: Section) => setOpenSection((cur) => (cur === s ? null : s));

  return (
    <div className="min-h-screen mesh-bg">
      <header className="glass border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 md:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg grad-btn flex items-center justify-center">
              <Icon name="Send" size={16} />
            </div>
            <span className="font-oswald text-lg font-bold text-white">Посты в канал</span>
          </div>
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

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-3">
        <AdminPostsTab token={token} onTotalChange={setPostsTotal}
          expanded={openSection === "posts"} onToggle={() => toggleSection("posts")} />
        <AdminBotTab token={token}
          expanded={openSection === "bot"} onToggle={() => toggleSection("bot")} />
        <AdminStoriesTab token={token}
          expanded={openSection === "stories"} onToggle={() => toggleSection("stories")} />
      </div>
    </div>
  );
}

export default PostsDashboard;