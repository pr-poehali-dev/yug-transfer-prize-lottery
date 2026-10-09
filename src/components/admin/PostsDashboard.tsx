import { useState } from "react";
import Icon from "@/components/ui/icon";
import { AdminPostsTab } from "./AdminPostsTab";
import { AdminBotTab } from "./AdminBotTab";
import { AdminKnowledgeTab } from "./AdminKnowledgeTab";

export function PostsDashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [postsTotal, setPostsTotal] = useState<number | null>(null);
  type Section = "posts" | "bot" | "kb" | "ai";
  const [openSection, setOpenSection] = useState<Section | null>(null);
  const toggleSection = (s: Section) => setOpenSection((cur) => (cur === s ? null : s));

  const tiles: { key: Section; title: string; sub: string; icon: string; tone: string }[] = [
    { key: "posts", title: "Посты в канал", sub: postsTotal != null ? `${postsTotal} постов` : "Публикация в группы", icon: "Send", tone: "violet" },
    { key: "bot", title: "Ежедневные посты", sub: "Автопостинг бота", icon: "Calendar", tone: "orange" },
    { key: "kb", title: "База знаний", sub: "Списки, группы, подписки", icon: "BookOpen", tone: "emerald" },
    { key: "ai", title: "ИИ Агенты", sub: "Умные помощники", icon: "Sparkles", tone: "sky" },
  ];
  const toneCls: Record<string, { box: string; icon: string; text: string }> = {
    violet: { box: "border-violet-500/25 bg-violet-500/[0.06] hover:bg-violet-500/[0.12]", icon: "bg-violet-500/15", text: "text-violet-400" },
    orange: { box: "border-orange-500/25 bg-orange-500/[0.06] hover:bg-orange-500/[0.12]", icon: "bg-orange-500/15", text: "text-orange-400" },
    sky: { box: "border-sky-500/25 bg-sky-500/[0.06] hover:bg-sky-500/[0.12]", icon: "bg-sky-500/15", text: "text-sky-400" },
    emerald: { box: "border-emerald-500/25 bg-emerald-500/[0.06] hover:bg-emerald-500/[0.12]", icon: "bg-emerald-500/15", text: "text-emerald-400" },
  };

  return (
    <div className="min-h-screen mesh-bg">
      <header className="glass border-b border-white/5 sticky top-0 z-50">
        <div className={`${openSection ? "max-w-none" : "max-w-5xl"} mx-auto px-4 md:px-8 flex items-center justify-between h-16`}>
          <div className="flex items-center gap-2">
            {openSection && (
              <button onClick={() => setOpenSection(null)}
                className="mr-1 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm border border-white/10 text-white/70 hover:text-white hover:bg-white/5">
                <Icon name="ArrowLeft" size={14} />Назад
              </button>
            )}
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

      {openSection ? (
        <div className="w-full px-3 md:px-8 py-4 md:py-6">
          {openSection === "posts" && (
            <AdminPostsTab token={token} onTotalChange={setPostsTotal} expanded onToggle={() => toggleSection("posts")} />
          )}
          {openSection === "bot" && <AdminBotTab token={token} expanded onToggle={() => toggleSection("bot")} />}
          {openSection === "kb" && <AdminKnowledgeTab token={token} expanded onToggle={() => toggleSection("kb")} />}
          {openSection === "ai" && (
            <div className="card-glow rounded-2xl p-8 md:p-12 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-sky-500/15 flex items-center justify-center">
                <Icon name="Sparkles" size={30} className="text-sky-400" />
              </div>
              <div className="text-xl font-semibold text-white">ИИ Агенты</div>
              <div className="text-sm text-white/50 max-w-md">
                Здесь появятся ИИ-помощники, которые будут работать за вас: отвечать в боте, писать посты, проверять людей.
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-sky-500/15 text-sky-300">Скоро</span>
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {tiles.map((t) => {
              const c = toneCls[t.tone];
              return (
                <button
                  key={t.key}
                  onClick={() => setOpenSection(t.key)}
                  className={`group text-left rounded-2xl border p-5 md:p-6 min-h-[160px] flex flex-col justify-between transition-all hover:-translate-y-0.5 ${c.box}`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${c.icon}`}>
                      <Icon name={t.icon} size={22} className={c.text} />
                    </div>
                    <Icon name="ArrowUpRight" size={20} className="text-white/30 group-hover:text-white/80 transition-colors" />
                  </div>
                  <div className="mt-4">
                    <div className="text-lg font-semibold text-white">{t.title}</div>
                    <div className="text-sm text-white/50 mt-0.5">{t.sub}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default PostsDashboard;