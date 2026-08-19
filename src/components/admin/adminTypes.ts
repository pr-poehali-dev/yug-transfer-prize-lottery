export const ADMIN_AUTH_URL = "https://functions.poehali.dev/cc8cbc36-edde-42f3-9196-fbfc8a6e8946";
export const SESSION_KEY = "admin_token";
export const POSTS_SESSION_KEY = "posts_token";

export const ADMIN_POSTS_URL = "https://functions.poehali.dev/0813e498-5f2e-4090-b643-15c885d057c8";
export const ADMIN_BOT_POSTS_URL = "https://functions.poehali.dev/9578d639-08e5-479c-938a-de950926d149";
export const SAIT_BOT_DAILY_URL = "https://functions.poehali.dev/9f4c8475-f48d-4145-999c-e5cfdabf5d21";
export const TG_ACCOUNTS_URL = "https://functions.poehali.dev/c23d251a-47cc-43e5-bd98-f9e0ebee8f2a";

export interface TgAccount {
  id: number;
  label: string;
  phone: string | null;
  is_active: boolean;
  is_banned: boolean;
  daily_invites_used: number;
  daily_reset_date: string | null;
  last_used_at: string | null;
  created_at: string | null;
  notes: string;
  needs_warmup: boolean;
  assigned_count?: number;
}

export interface Post {
  id: number;
  title: string;
  text: string;
  photo_url: string;
  button_text: string;
  button_url: string;
  button2_text: string;
  button2_url: string;
  status: "draft" | "scheduled" | "published" | "failed" | "expired";
  scheduled_at: string | null;
  published_at: string | null;
  telegram_message_id: number | null;
  created_at: string | null;
  updated_at: string | null;
  auto_expire_at?: string | null;
  expired_at?: string | null;
  message_ids?: number[];
  chats?: string;
}