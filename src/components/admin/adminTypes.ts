const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "");
const api = (name: string, platformUrl: string) => (API_BASE ? `${API_BASE}/${name}` : platformUrl);

export const ADMIN_AUTH_URL = api("admin-auth", "https://functions.poehali.dev/cc8cbc36-edde-42f3-9196-fbfc8a6e8946");
export const SESSION_KEY = "admin_token";
export const POSTS_SESSION_KEY = "posts_token";

export const ADMIN_POSTS_URL = api("admin-posts", "https://functions.poehali.dev/95fc9528-84af-4b3c-8f32-89515c86411c");
export const KNOWLEDGE_BASE_URL = api("knowledge-base", "https://functions.poehali.dev/92d37448-fb0d-469a-8222-a627b1586394");
export const KB_BOT_URL = api("kb-bot", "https://functions.poehali.dev/ed74936b-d187-466b-bd49-74818d8cceab");
export const TG_LOOKUP_URL = api("tg-lookup", "https://functions.poehali.dev/cc462dc8-83da-48a4-86f1-db3d0501d54a");

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