import type { CommentResponse, CommentRow, Env } from "../types";
import { validatePagePath } from "../utils/validate";
import { getVisitorHash } from "../utils/visitor";

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
    likeCount: row.like_count ?? 0,
    liked: row.liked === 1,
  };
}

export async function getComments(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pagePath = validatePagePath(url.searchParams.get("path"));
  const visitorHash = await getVisitorHash(request);

  const result = await env.DB.prepare(
    `SELECT
      comments.id,
      comments.page_path,
      comments.parent_id,
      comments.nickname,
      comments.email,
      comments.email_hash,
      comments.website,
      comments.content,
      comments.status,
      comments.created_at,
      comments.updated_at,
      COUNT(comment_likes.visitor_hash) AS like_count,
      MAX(CASE WHEN comment_likes.visitor_hash = ? THEN 1 ELSE 0 END) AS liked
    FROM comments
    LEFT JOIN comment_likes ON comment_likes.comment_id = comments.id
    WHERE comments.page_path = ? AND comments.status = ?
    GROUP BY comments.id
    ORDER BY comments.created_at ASC`,
  )
    .bind(visitorHash, pagePath, "approved")
    .all<CommentRow>();

  return Response.json({
    ok: true,
    comments: (result.results ?? []).map(toCommentResponse),
  });
}
