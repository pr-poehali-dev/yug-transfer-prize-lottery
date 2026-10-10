import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import { KNOWLEDGE_BASE_URL } from "../adminTypes";

export function JunkCleanup({ token, onChanged }: { token: string; onChanged: () => void }) {
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const d = await fetch(`${KNOWLEDGE_BASE_URL}?entity=junk`, { headers: { "X-Admin-Token": token } }).then((r) => r.json());
      if (d.ok) setCount(d.count);
    } catch { /* */ }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const clean = () => {
    toast(`Удалить ${count} пустых карточек?`, {
      description: "Только ID, без username, фото и описания, а имя пустое или из цифр.",
      action: {
        label: "Удалить",
        onClick: async () => {
          setBusy(true);
          try {
            const d = await fetch(`${KNOWLEDGE_BASE_URL}?entity=junk`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Admin-Token": token },
              body: "{}",
            }).then((r) => r.json());
            if (d.ok) {
              toast.success(`Удалено карточек: ${d.deleted}`);
              onChanged();
            } else toast.error("Не удалось удалить");
          } catch {
            toast.error("Не удалось удалить");
          }
          setBusy(false);
          load();
        },
      },
      cancel: { label: "Отмена", onClick: () => {} },
    });
  };

  return (
    <div className="rounded-2xl border border-white/10 space-card p-4 flex flex-wrap items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
        <Icon name="Eraser" fallback="Trash2" size={17} className="text-red-400" />
      </div>
      <div className="flex-1 min-w-[200px]">
        <div className="text-sm font-medium text-white">Пустые карточки</div>
        <div className="text-xs text-white/50">
          Только ID: без username, фото и описания, имя пустое или из цифр. Карточки с жалобами не трогаем.
        </div>
      </div>
      <span className="text-sm text-white/70 tabular-nums">{count === null ? "…" : count}</span>
      <button onClick={clean} disabled={busy || !count}
        className="rounded-xl px-4 py-2 text-sm font-medium bg-red-500/80 hover:bg-red-500 text-white disabled:opacity-40 flex items-center gap-2">
        <Icon name={busy ? "Loader2" : "Trash2"} size={14} className={busy ? "animate-spin" : ""} />Очистить
      </button>
    </div>
  );
}

export default JunkCleanup;
