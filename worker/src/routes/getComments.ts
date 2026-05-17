import type { CommentResponse, CommentRow, Env } from "../types";
import { validatePagePath } from "../utils/validate";

function toCommentResponse(row: CommentRow): CommentResponse {
  return {
    id: row.id,
    pagePath: row.page_path,
    parentId: row.parent_id,
    nickname: row.nickname,
    emailHash: row.email_hash,
    website: row.website,
    content: row.content,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getComments(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pagePath = validatePagePath(url.searchParams.get("path"));

  const result = await env.DB.prepare(
    `SELECT
      id,
      page_path,
      parent_id,
      nickname,
      email,
      email_hash,
      website,
      content,
      status,
      created_at,
      updated_at
    FROM comments
    WHERE page_path = ? AND status = ?
    ORDER BY created_at ASC`,
  )
    .bind(pagePath, "approved")
    .all<CommentRow>();

  return Response.json({
    ok: true,
    comments: (result.results ?? []).map(toCommentResponse),
  });
}
