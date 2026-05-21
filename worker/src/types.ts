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
