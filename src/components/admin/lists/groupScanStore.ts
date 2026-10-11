import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TG_LOOKUP_API } from "./listTypes";

export interface GroupJob {
  id: number;
  chat: string;
  title: string;
  status: string;
  added: number;
  skipped: number;
  fetched: number;
  total: number;
  error: string;
  mode: string;
  progress: number;
  in_base?: number;
  running?: boolean;
}

const jobs = new Map<string, GroupJob>();
const stopFlags = new Map<string, boolean>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const key = (chat: string) => chat.trim().toLowerCase();

export function useGroupJobs() {
  const [, set] = useState(0);
  useEffect(() => {
    const l = () => set((x) => x + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return (chat: string) => jobs.get(key(chat));
}

export async function loadGroupJobs(token: string) {
  const d = await fetch(`${TG_LOOKUP_API}?action=group_jobs`, { headers: { "X-Admin-Token": token } })
    .then((r) => r.json()).catch(() => null);
  if (!d?.ok) return;
  for (const j of d.items as GroupJob[]) {
    const k = key(j.chat);
    if (jobs.get(k)?.running) continue;
    jobs.set(k, { ...j, running: false });
  }
  emit();
}

export function stopGroupScan(token: string, chat: string) {
  const k = key(chat);
  stopFlags.set(k, true);
  const j = jobs.get(k);
  if (j?.id) fetch(`${TG_LOOKUP_API}?action=group_stop&job=${j.id}`, { headers: { "X-Admin-Token": token } }).catch(() => null);
  if (j) jobs.set(k, { ...j, running: false, status: "stopped" });
  emit();
}

export async function startGroupScan(token: string, chat: string, title: string) {
  const k = key(chat);
  if (jobs.get(k)?.running) return;
  stopFlags.set(k, false);
  const prev = jobs.get(k);
  jobs.set(k, { ...(prev || { id: 0, chat, title, added: 0, skipped: 0, fetched: 0, total: 0, error: "", mode: "members", progress: 0 }),
    status: "running", error: "", running: true });
  emit();
  let jobId = prev && ["running", "paused", "stopped"].includes(prev.status) ? prev.id : 0;
  let fails = 0;
  while (!stopFlags.get(k)) {
    try {
      const q = jobId ? `job=${jobId}` : `chat=${encodeURIComponent(chat)}`;
      const d = await fetch(`${TG_LOOKUP_API}?action=group&${q}`, { headers: { "X-Admin-Token": token } }).then((r) => r.json());
      const j = d.job as GroupJob | undefined;
      if (!j) {
        jobs.set(k, { ...jobs.get(k)!, running: false, status: "error", error: d.error || "Не удалось просканировать" });
        toast.error(`${title}: ${d.error || "не удалось просканировать"}`);
        break;
      }
      jobId = j.id;
      fails = 0;
      if (stopFlags.get(k)) break;
      const done = j.status !== "running";
      jobs.set(k, { ...jobs.get(k)!, ...j, running: !done });
      emit();
      if (j.status === "done") { toast.success(`${title}: готово, новых в базе ${j.added}`); break; }
      if (j.status === "error") { toast.error(`${title}: ${j.error}`); break; }
      if (j.status === "paused") { toast(`${title}: ${j.error}`); break; }
    } catch {
      fails += 1;
      if (fails >= 4) {
        jobs.set(k, { ...jobs.get(k)!, running: false, error: "Связь прервалась — нажмите «Сканировать», продолжит с места остановки" });
        break;
      }
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  const cur = jobs.get(k);
  if (cur) jobs.set(k, { ...cur, running: false });
  emit();
}
