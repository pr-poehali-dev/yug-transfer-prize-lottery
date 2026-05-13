export interface Settings {
  enabled: boolean;
  message_template: string;
  photo_url?: string;
  button_text?: string;
  button_url?: string;
  last_checked_msg_id: number;
  last_run_at: string | null;
  loop_heartbeat: string | null;
  loop_alive?: boolean;
  loop_age_sec?: number | null;
  auto_revived?: boolean;
  auto_revived_after_sec?: number | null;
}

export interface HistoryItem {
  id: number;
  user_id: number;
  username: string;
  first_name: string;
  message_sent: boolean;
  message_sent_at: string | null;
  send_status: string | null;
}

export interface ResendItem {
  id: number;
  user_id: number;
  username: string;
  first_name: string;
  send_status: string;
  queued: boolean;
}

export interface ResendQueueStatus {
  queued: number;
  ok: number;
  failed: number;
}

export function fmtAgo(ts: number | null): string {
  if (!ts) return "—";
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 5) return "только что";
  if (sec < 60) return `${sec} сек назад`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин назад`;
  const h = Math.floor(min / 60);
  return `${h} ч назад`;
}

export function isLoopAlive(heartbeat: string | null): boolean {
  if (!heartbeat) return false;
  const hb = new Date(heartbeat).getTime();
  // С паузами 180с между циклами, нормальный heartbeat до ~210 сек
  // Считаем мёртвым если > 4 мин
  return Date.now() - hb < 240_000;
}

export function personalize(template: string, firstName: string, username: string): string {
  const fname = (firstName || "").trim() || "водитель";
  const uname = (username || "").trim();
  let txt = template || "";

  txt = txt.replaceAll("{name}", fname).replaceAll("{username}", uname);

  txt = txt.replace(/(Уважаем(?:ый|ая|ые))\s*([!,])/g, `$1 ${fname}$2`);
  txt = txt.replace(
    /(Здравствуй(?:те)?|Привет|Добрый день|Добрый вечер|Доброе утро)\s*([!,])/g,
    `$1, ${fname}$2`,
  );

  if (!txt.includes(fname) && !/^\s*(Уважаем|Здравствуй|Привет|Добрый|Доброе)/.test(txt)) {
    txt = `Здравствуйте, ${fname}!\n\n${txt}`;
  }
  return txt;
}