import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ListItem, Snapshot, SNAPSHOTS_API, FIELD_LABELS, fmtDate } from "./listTypes";

interface Props {
  token: string;
  item: ListItem | null;
  open: boolean;
  onClose: () => void;
}

const SOURCE_LABEL: Record<string, string> = {
  created: "Карточка создана",
  scan: "Сканирование",
  manual: "Изменено вручную",
};

function Field({ icon, value, changed, mono }: { icon: string; value: string; changed: boolean; mono?: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs rounded-md px-1.5 py-0.5 -mx-1.5 ${changed ? "bg-amber-500/15 text-amber-200" : "text-white/70"}`}>
      <Icon name={icon} size={12} className={changed ? "text-amber-300" : "text-white/40"} />
      <span className={`truncate ${mono ? "font-mono" : ""}`}>{value || "—"}</span>
    </div>
  );
}

export function LayersDialog({ token, item, open, onClose }: Props) {
  const [layers, setLayers] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !item) return;
    setLoading(true);
    fetch(`${SNAPSHOTS_API}&id=${item.id}`, { headers: { "X-Admin-Token": token } })
      .then((r) => r.json())
      .then((d) => d.ok && setLayers(d.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, item, token]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-[#14141c] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle>Все изменения аккаунта</DialogTitle>
          <DialogDescription className="text-white/50">
            {item?.name || item?.username || "Карточка"} · слоёв: {layers.length || item?.layers || 1}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-sm text-white/50 py-8 text-center">Загрузка…</div>
        ) : layers.length === 0 ? (
          <div className="text-sm text-white/50 py-8 text-center">Изменений пока нет</div>
        ) : (
          <div className="relative pl-5">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/10" />
            <div className="space-y-4">
              {layers.map((l, idx) => {
                const ch = new Set(l.changed);
                const latest = idx === 0;
                return (
                  <div key={l.id} className="relative">
                    <div
                      className={`absolute -left-5 top-3 w-3.5 h-3.5 rounded-full border-2 ${
                        latest ? "bg-violet-500 border-violet-300" : "bg-[#14141c] border-white/30"
                      }`}
                    />
                    <div className={`rounded-xl border p-3 ${latest ? "border-violet-500/40 bg-violet-500/[0.06]" : "border-white/10 bg-white/[0.03]"}`}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-medium text-white/80 flex items-center gap-1.5">
                          {latest && <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500 text-white">сейчас</span>}
                          {SOURCE_LABEL[l.source] || l.source}
                        </span>
                        <span className="text-[11px] text-white/40">{fmtDate(l.created_at, true)}</span>
                      </div>
                      {l.changed.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {l.changed.map((f) => (
                            <span key={f} className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-200">
                              изменено: {FIELD_LABELS[f] || f}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-3">
                        <div className={`w-16 h-16 rounded-lg overflow-hidden bg-white/5 shrink-0 flex items-center justify-center ${ch.has("photo_url") ? "ring-2 ring-amber-400" : ""}`}>
                          {l.photo_url ? (
                            <img src={l.photo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Icon name="User" size={22} className="text-white/30" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className={`text-sm font-medium truncate rounded-md px-1.5 -mx-1.5 ${ch.has("name") ? "bg-amber-500/15 text-amber-100" : "text-white"}`}>
                            {l.name || "Без имени"}
                          </div>
                          <Field icon="Hash" value={l.tg_id ? String(l.tg_id) : ""} changed={ch.has("tg_id")} mono />
                          <Field icon="Phone" value={l.phone} changed={ch.has("phone")} />
                          <Field icon="AtSign" value={l.username} changed={ch.has("username")} />
                          {l.bio && <Field icon="FileText" value={l.bio} changed={ch.has("bio")} />}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default LayersDialog;
