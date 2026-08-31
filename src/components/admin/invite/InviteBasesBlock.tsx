import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import { INVITE_BASES_URL, type InviteBase } from "../adminTypes";

interface Props {
  token: string;
  bases: InviteBase[];
  activeBase: number;
  loading: boolean;
  onChanged: (bases: InviteBase[], activeBase: number) => void;
  onReload: () => void;
}

export function InviteBasesBlock({ token, bases, activeBase, loading, onChanged, onReload }: Props) {
  const [busy, setBusy] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [fileText, setFileText] = useState("");
  const [fileInfo, setFileInfo] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const call = async (action: string, body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch(`${INVITE_BASES_URL}?action=${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.bases) onChanged(data.bases, data.active_base ?? activeBase);
      return data;
    } catch {
      return { error: "Ошибка соединения" };
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (f: File | null) => {
    if (!f) return;
    const text = await f.text();
    const count = text.split(/[\s,;]+/).filter(Boolean).length;
    setFileText(text);
    setFileInfo(`${f.name} · строк: ${count.toLocaleString("ru")}`);
    if (!uploadName) setUploadName(f.name.replace(/\.[^.]+$/, ""));
  };

  const handleUpload = async () => {
    if (!fileText.trim()) return;
    setUploadError("");
    const data = await call("create", { name: uploadName || "Новая база", content: fileText });
    if (data.ok) {
      alert(
        `Загружено контактов: ${data.imported}\n` +
        `Дубли: ${data.duplicates || 0}\nНераспознанные строки: ${data.skipped || 0}`
      );
      setFileText(""); setFileInfo(""); setUploadName(""); setShowUpload(false);
      if (fileRef.current) fileRef.current.value = "";
    } else {
      setUploadError(data.error || "Не удалось загрузить базу");
    }
  };

  const handleDelete = async (b: InviteBase) => {
    if (!confirm(`Удалить базу «${b.name}» и все ${b.total.toLocaleString("ru")} контактов?`)) return;
    await call("delete", { id: b.id });
  };

  const handleReset = async (b: InviteBase) => {
    if (!confirm(`Вернуть в очередь все неудачные контакты базы «${b.name}»?`)) return;
    const d = await call("reset_status", { id: b.id });
    if (d.ok) alert(`Возвращено в очередь: ${d.reset}`);
  };

  const handleRename = async (b: InviteBase) => {
    const name = prompt("Новое название базы", b.name);
    if (!name || name === b.name) return;
    await call("rename", { id: b.id, name });
  };

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-white/60 font-medium flex items-center gap-1.5">
          <Icon name="Database" size={12} /> Базы для инвайта · {bases.length}
        </p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowUpload(v => !v)}
            className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
            <Icon name={showUpload ? "X" : "Plus"} size={12} />{showUpload ? "Отмена" : "Добавить"}
          </button>
          <button type="button" onClick={onReload} disabled={loading}
            className="text-white/40 hover:text-white transition-colors">
            <Icon name="RefreshCw" size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {showUpload && (
        <div className="mt-2 rounded-lg bg-emerald-500/5 border border-emerald-500/15 p-2.5 space-y-2">
          <input
            value={uploadName}
            onChange={e => setUploadName(e.target.value)}
            placeholder="Название базы"
            className="w-full bg-white/5 border border-white/10 focus:border-emerald-500/50 rounded-lg px-2.5 py-1.5 text-white text-[13px] outline-none placeholder-white/25"
          />
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.csv,text/plain,text/csv"
            onChange={e => handleFile(e.target.files?.[0] || null)}
            className="w-full text-[12px] text-white/60 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:bg-white/10 file:text-white/80 file:text-[11px]"
          />
          {fileInfo && <p className="text-[11px] text-emerald-300">{fileInfo}</p>}
          {uploadError && (
            <p className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-2 leading-relaxed break-words">
              {uploadError}
            </p>
          )}
          <p className="text-[10px] text-white/35 leading-relaxed">
            Файл .txt или .csv: в строке @username, ссылка t.me, числовой ID или телефон +7… Дубли убираются автоматически.
          </p>
          <button type="button" onClick={handleUpload} disabled={busy || !fileText}
            className="w-full py-1.5 rounded-lg bg-emerald-500/80 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-medium transition-colors">
            {busy ? "Загружаю…" : "Загрузить базу"}
          </button>
        </div>
      )}

      <div className="mt-2 space-y-1.5">
        {bases.map(b => {
          const isActive = b.id === activeBase;
          return (
            <div key={b.id}
              className={`rounded-lg border p-2.5 transition-colors ${
                isActive ? "bg-emerald-500/10 border-emerald-500/30" : "bg-white/5 border-white/10"
              }`}>
              <div className="flex items-start justify-between gap-2">
                <button type="button" onClick={() => !isActive && call("activate", { id: b.id })}
                  className="min-w-0 text-left flex items-start gap-1.5">
                  <Icon name={isActive ? "CircleCheck" : "Circle"} size={14}
                    className={`mt-0.5 shrink-0 ${isActive ? "text-emerald-400" : "text-white/30"}`} />
                  <span className="min-w-0">
                    <span className="block text-[13px] text-white truncate">{b.name}</span>
                    <span className="block text-[10px] text-white/40">
                      {isActive ? "активная база · " : ""}всего {b.total.toLocaleString("ru")}
                    </span>
                  </span>
                </button>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button type="button" onClick={() => handleRename(b)} className="text-white/35 hover:text-white">
                    <Icon name="Pencil" size={12} />
                  </button>
                  <button type="button" onClick={() => handleReset(b)} className="text-white/35 hover:text-amber-300">
                    <Icon name="RotateCcw" size={12} />
                  </button>
                  <button type="button" onClick={() => handleDelete(b)} className="text-white/35 hover:text-red-400">
                    <Icon name="Trash2" size={12} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1 mt-2">
                {[
                  { l: "в очереди", v: b.pending, c: "text-sky-300" },
                  { l: "приглашено", v: b.added, c: "text-emerald-300" },
                  { l: "ошибки", v: b.failed, c: "text-amber-300" },
                  { l: "без ника", v: b.skipped, c: "text-white/40" },
                ].map(s => (
                  <div key={s.l} className="rounded-md bg-black/20 px-1.5 py-1">
                    <p className={`text-[12px] font-semibold ${s.c}`}>{s.v.toLocaleString("ru")}</p>
                    <p className="text-[9px] text-white/35 leading-tight">{s.l}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {!bases.length && (
          <p className="text-[11px] text-white/30">{loading ? "Загружаю…" : "Баз пока нет"}</p>
        )}
      </div>
    </div>
  );
}

export default InviteBasesBlock;