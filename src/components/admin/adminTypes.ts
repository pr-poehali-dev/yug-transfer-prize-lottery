export const ADMIN_AUTH_URL = "https://functions.poehali.dev/cc8cbc36-edde-42f3-9196-fbfc8a6e8946";
export const SESSION_KEY = "admin_token";

export const ADMIN_POSTS_URL = "https://functions.poehali.dev/0813e498-5f2e-4090-b643-15c885d057c8";
export const ADMIN_BOT_POSTS_URL = "https://functions.poehali.dev/9578d639-08e5-479c-938a-de950926d149";
export const SAIT_BOT_DAILY_URL = "https://functions.poehali.dev/9f4c8475-f48d-4145-999c-e5cfdabf5d21";
export const UPLOAD_VIDEO_URL = "https://functions.poehali.dev/f6d6a065-4281-4091-ac9e-9e3121bf2571";
export const ADMIN_DRIVER_SUBS_URL = "https://functions.poehali.dev/95d0380a-04e8-4a3c-88db-9c256a11f1f6";
export const ADMIN_BOT_STORIES_URL = "https://functions.poehali.dev/58582409-0dd6-4199-9901-fc7977290659";
export const TG_USER_AUTH_URL = "https://functions.poehali.dev/1d230a4a-3752-4182-9d42-e67398b99b97";
export const TG_USER_STORY_URL = "https://functions.poehali.dev/e47b662c-3d9d-42c4-aa13-dda080f9a777";
export const TG_USER_AUTH2_URL = "https://functions.poehali.dev/731984b0-8855-47a8-a7b1-6c6a4ec6d87f";
export const EXCLUDED_WATCHER_URL = "https://functions.poehali.dev/2db8bbe3-c6b3-4bda-866c-c22a8c621520";
export const UG_DRIVER_PARSER_URL = "https://functions.poehali.dev/d7944323-8734-4dd3-a3a9-8787dbb57ac4";

export type AdminTab = "posts" | "bot" | "drivers" | "stories";

export interface BotStory {
  id: number;
  video_url: string;
  caption: string;
  is_used: boolean;
  last_sent_at: string | null;
  last_status: string | null;
  created_at: string | null;
}

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