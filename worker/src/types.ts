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

export interface AdminReportRow {
  id: string;
  comment_id: string;
  reporter_email: string;
  reason: ReportReason;
  message: string | null;
  status: ReportStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  comment_id_joined: string | null;
  comment_page_path: string | null;
  comment_parent_id: string | null;
  comment_nickname: string | null;
  comment_email: string | null;
  comment_email_hash: string | null;
  comment_website: string | null;
  comment_content: string | null;
  comment_status: string | null;
  comment_created_at: string | null;
  comment_updated_at: string | null;
  like_count?: number;
}

export interface AdminReportComment {
  id: string;
  pagePath: string | null;
  parentId: string | null;
  nickname: string | null;
  email: string | null;
  emailHash: string | null;
  website: string | null;
  content: string | null;
  status: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  likeCount: number;
}

export interface AdminReportItem {
  id: string;
  commentId: string;
  reporterEmail: string;
  reason: ReportReason;
  message: string | null;
  status: ReportStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  comment: AdminReportComment | null;
}

export interface AdminReportResponse {
  ok: true;
  reports: AdminReportItem[];
}
