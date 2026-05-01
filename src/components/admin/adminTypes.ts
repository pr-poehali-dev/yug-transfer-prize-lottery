export const ADMIN_AUTH_URL = "https://functions.poehali.dev/cc8cbc36-edde-42f3-9196-fbfc8a6e8946";
export const SESSION_KEY = "admin_token";

export const ADMIN_POSTS_URL = "https://functions.poehali.dev/0813e498-5f2e-4090-b643-15c885d057c8";
export const ADMIN_BOT_POSTS_URL = "https://functions.poehali.dev/9578d639-08e5-479c-938a-de950926d149";
export const SAIT_BOT_DAILY_URL = "https://functions.poehali.dev/9f4c8475-f48d-4145-999c-e5cfdabf5d21";
export const UPLOAD_VIDEO_URL = "https://functions.poehali.dev/f6d6a065-4281-4091-ac9e-9e3121bf2571";
export const ADMIN_DRIVER_SUBS_URL = "https://functions.poehali.dev/95d0380a-04e8-4a3c-88db-9c256a11f1f6";

export type AdminTab = "posts" | "bot" | "drivers";

export interface DriverSub {
  id: number;
  telegram_id: number;
  username: string;
  first_name: string;
  plan: string;
  amount_rub: number;
  started_at: string | null;
  expires_at: string | null;
  status: string;
}

export interface Post {
  id: number;
  title: string;
  text: string;
  photo_url: string;
  video_note_url: string;
  button_text: string;
  button_url: string;
  button2_text: string;
  button2_url: string;
  status: "draft" | "scheduled" | "published" | "failed";
  scheduled_at: string | null;
  published_at: string | null;
  telegram_message_id: number | null;
  created_at: string | null;
  updated_at: string | null;
}
