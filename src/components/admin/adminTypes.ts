export const ADMIN_AUTH_URL = "https://functions.poehali.dev/cc8cbc36-edde-42f3-9196-fbfc8a6e8946";
export const SESSION_KEY = "admin_token";
export const POSTS_SESSION_KEY = "posts_token";

export const ADMIN_POSTS_URL = "https://functions.poehali.dev/0813e498-5f2e-4090-b643-15c885d057c8";
export const ADMIN_BOT_POSTS_URL = "https://functions.poehali.dev/9578d639-08e5-479c-938a-de950926d149";
export const SAIT_BOT_DAILY_URL = "https://functions.poehali.dev/9f4c8475-f48d-4145-999c-e5cfdabf5d21";
export const TG_ACCOUNTS_URL = "https://functions.poehali.dev/c23d251a-47cc-43e5-bd98-f9e0ebee8f2a";
export const INVITE_BASES_URL = "https://functions.poehali.dev/3987ac55-9490-466a-ac86-784129dab17c";
export const INVITE_RUN_URL = "https://functions.poehali.dev/66269b46-56a1-420d-9371-47218b8605eb";

export interface InviteRunAccount {
  id: number;
  label: string;
  used: number;
  limit: number;
  left: number;
  warmup: boolean;
}

export interface InvitePaceOption {
  key: string;
  title: string;
  per_day: number;
  delay: number;
}

export interface InviteRunState {
  pace: string;
  delay_sec: number;
  pace_options: InvitePaceOption[];
  is_active: boolean;
  title: string;
  subtitle: string;
  total_planned: number;
  done: number;
  added: number;
  privacy: number;
  failed: number;
  last_message: string;
  started_at: string | null;
  pending: number;
  capacity_today: number;
  accounts: InviteRunAccount[];
}

export interface InviteBase {
  id: number;
  name: string;
  note: string;
  created_at: string;
  total: number;
  pending: number;
  added: number;
  failed: number;
  skipped: number;
}

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