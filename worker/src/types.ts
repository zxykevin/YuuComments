export interface Env {
  DB: D1Database;
  TURNSTILE_SECRET_KEY?: string;
  ADMIN_TOKEN?: string;
}

export interface CommentRow {
  id: string;
  page_path: string;
  parent_id: string | null;
  nickname: string;
  email: string | null;
  email_hash: string | null;
  website: string | null;
  content: string;
  status: string;
  ip: string | null;
  created_at: string;
  updated_at: string;
  like_count?: number;
  liked?: number;
}

export interface CommentResponse {
  id: string;
  pagePath: string;
  parentId: string | null;
  nickname: string;
  emailHash: string | null;
  website: string | null;
  content: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  likeCount: number;
  liked: boolean;
}

export interface AdminCommentResponse extends CommentResponse {
  email: string | null;
  ip: string | null;
}

export interface CreateCommentInput {
  pagePath: string;
  parentId: string | null;
  nickname: string;
  email: string | null;
  website: string | null;
  content: string;
  turnstileToken: string;
}

export type CommentStatus = "pending" | "approved" | "spam" | "deleted";

export type ReportReason =
  | "spam"
  | "abuse"
  | "harassment"
  | "privacy"
  | "illegal"
  | "other";

export type ReportStatus = "open" | "resolved" | "ignored";

export interface CommentReportRow {
  id: string;
  comment_id: string;
  reporter_hash: string;
  reporter_email: string;
  reason: ReportReason;
  message: string | null;
  status: ReportStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}
