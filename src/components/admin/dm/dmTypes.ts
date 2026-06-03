export type LoginStep = "idle" | "phone" | "code" | "2fa";

export interface DmAccount {
  id: number;
  label: string;
  is_banned: boolean;
  is_active: boolean;
  pending: number;
}

export interface DmCounts {
  pending: number; sent: number; privacy: number; failed: number; in_progress: number; total: number;
}

export interface RunResult {
  ok?: boolean; error?: string; session_dead?: boolean;
  sent?: number; privacy?: number; failed?: number; removed?: number; peer_flood?: boolean; empty?: boolean;
}
