import { useState } from "react";
import Icon from "@/components/ui/icon";
import { type HistoryItem, personalize } from "./excludedTypes";

interface Props {
  history: HistoryItem[];
  template: string;
  photoUrl?: string;
  buttonText?: string;
  buttonUrl?: string;
  editingId: number | null;
  editName: string;
  setEditName: (v: string) => void;
  editUsername: string;
  setEditUsername: (v: string) => void;
  setEditingId: (v: number | null) => void;
  startEdit: (h: HistoryItem) => void;
  saveEdit: () => void;
  sendOne: (id: number) => void;
  deleteOne: (id: number) => void;
  sendingOneId: number | null;
}

export function ExcludedHistoryCard({
  history,
  template,
  photoUrl = "",
  buttonText = "",
  buttonUrl = "",
  editingId,
  editName,
  setEditName,
  editUsername,
  setEditUsername,
  setEditingId,
  startEdit,
  saveEdit,
  sendOne,
  deleteOne,
  sendingOneId,
}: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  return (
    <div className="rounded-2xl border border-white/8 p-5" style={{ background: "rgba(255,255,255,0.02)" }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
          <Icon name="History" size={20} className="text-purple-400" />
        </div>
        <div>
          <h3 className="text-white font-medium text-lg">История отправок</h3>
          <p className="text-white/40 text-xs">{history.length} записей</p>
        </div>
      </div>

      {history.length === 0 ? (
        <p className="text-white/30 text-center py-6 text-sm">Пока никому не отправляли</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {history.map((h, i) => {
            const isEditing = editingId === h.id;
            const isExpanded = expandedId === h.id;
            const previewName = isEditing ? editName : (h.first_name || "");
            const previewUname = isEditing ? editUsername : (h.username || "");
            return (
            <div key={h.id ?? `row-${i}`} className={`rounded-lg border ${isEditing ? "border-amber-500/30 bg-amber-500/5" : "bg-white/3 border-white/8"}`}>
              <div className="flex items-center gap-3 p-2.5">
                <Icon
                  name={h.message_sent ? "CheckCircle" : "AlertCircle"}
                  size={16}
                  className={`flex-shrink-0 ${h.message_sent ? "text-emerald-400" : "text-red-400"}`}
                />
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex gap-2">
                      <input
                        value={editName} onChange={e => setEditName(e.target.value)}
                        placeholder="Имя"
                        className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs outline-none focus:border-amber-500/50"
                      />
                      <input
                        value={editUsername} onChange={e => setEditUsername(e.target.value)}
                        placeholder="username"
                        className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs outline-none focus:border-amber-500/50"
                      />
                    </div>
                  ) : (
                    <>
                      <p className="text-white text-sm truncate">
                        {h.first_name || "?"} {h.username && <span className="text-white/40">@{h.username}</span>}
                      </p>
                      <p className="text-white/40 text-[11px] truncate">
                        {h.message_sent_at && new Date(h.message_sent_at).toLocaleString("ru-RU")}
                        {h.send_status && h.send_status !== "ok" && ` · ${h.send_status}`}
                      </p>
                    </>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {isEditing ? (
                    <>
                      <button onClick={saveEdit} title="Сохранить"
                        className="w-8 h-8 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 flex items-center justify-center">
                        <Icon name="Check" size={14} className="text-emerald-400" />
                      </button>
                      <button onClick={() => setEditingId(null)} title="Отмена"
                        className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center">
                        <Icon name="X" size={14} className="text-white/50" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => sendOne(h.id)} disabled={sendingOneId === h.id}
                        title="Отправить повторно"
                        className="w-8 h-8 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 flex items-center justify-center disabled:opacity-40"
                      >
                        {sendingOneId === h.id
                          ? <div className="w-3 h-3 border border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                          : <Icon name="Send" size={14} className="text-emerald-400" />}
                      </button>
                      <button onClick={() => startEdit(h)} title="Редактировать"
                        className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center">
                        <Icon name="Pencil" size={14} className="text-white/50" />
                      </button>
                      <button onClick={() => deleteOne(h.id)} title="Удалить"
                        className="w-8 h-8 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center">
                        <Icon name="Trash2" size={14} className="text-white/50 hover:text-red-400" />
                      </button>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : h.id)}
                        title={isExpanded ? "Скрыть превью" : "Показать что отправилось"}
                        className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
                      >
                        <Icon name={isExpanded ? "ChevronUp" : "ChevronDown"} size={14} className="text-white/50" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {(isEditing || isExpanded) && (
                <div className="px-3 pb-3 pt-1">
                  <p className="text-[10px] text-white/40 mb-1.5 inline-flex items-center gap-1">
                    <Icon name="MessageSquare" size={11} />
                    {isEditing ? `Превью для ${editName || "водителя"}:` : `Что отправилось ${previewName || "водителю"}:`}
                  </p>
                  <div className="rounded-xl p-2.5" style={{ background: "#0e1621" }}>
                    <div className="flex items-start gap-1.5">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">Я</div>
                      <div className="flex-1 min-w-0">
                        <div className="inline-block max-w-full rounded-2xl rounded-tl-md overflow-hidden" style={{ background: "#182533" }}>
                          {photoUrl && (
                            <img src={photoUrl} alt="фото" className="block w-full object-cover" style={{ maxHeight: 200, maxWidth: 280 }} />
                          )}
                          <div className="px-2.5 py-1.5">
                            {template?.trim() ? (
                              <p className="text-white text-[12px] leading-snug whitespace-pre-wrap break-words">
                                {personalize(template, previewName, previewUname)}
                              </p>
                            ) : (
                              <p className="text-white/40 text-[12px] italic">Текст шаблона не задан</p>
                            )}
                            <div className="text-white/40 text-[9px] text-right mt-0.5">
                              {h.message_sent_at
                                ? new Date(h.message_sent_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
                                : "—"}
                            </div>
                          </div>
                          {buttonText.trim() && buttonUrl.trim() && (
                            <a href={buttonUrl} target="_blank" rel="noopener noreferrer"
                              className="block text-center px-2 py-1.5 text-[11px] font-medium border-t"
                              style={{ background: "#243447", color: "#6ab3f3", borderColor: "rgba(255,255,255,0.05)" }}>
                              {buttonText}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ExcludedHistoryCard;