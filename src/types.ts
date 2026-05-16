export interface Env {
  DB: D1Database;
  TURNSTILE_SECRET_KEY?: string;
}

export interface CommentRow {
  id: string;
  page_path: string;
  parent_id: string | null;
  nickname: string;
  email_hash: string | null;
  website: string | null;
  content: string;
  status: string;
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

export interface CreateCommentInput {
  pagePath: string;
  parentId: string | null;
  nickname: string;
  email: string | null;
  website: string | null;
  content: string;
  turnstileToken: string;
}
