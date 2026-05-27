import type { Env } from "../types";
import { validateCommentId } from "../utils/validate";
import { getVisitorHash } from "../utils/visitor";

type LikeSummary = {
  likeCount: number;
  liked: boolean;
};

export async function likeComment(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const commentId = validateCommentId(id);
  const visitorHash = await getVisitorHash(request);

  const comment = await getApprovedComment(env, commentId);
  if (!comment) {
    return commentNotFoundResponse();
  }

  await env.DB.prepare(
    `INSERT OR IGNORE INTO comment_likes (
      comment_id,
      visitor_hash
    ) VALUES (?, ?)`,
  )
    .bind(commentId, visitorHash)
    .run();

  const summary = await getLikeSummary(env, commentId, visitorHash);

  return Response.json({
    ok: true,
    commentId,
    likeCount: summary.likeCount,
    liked: true,
  });
}

export async function unlikeComment(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const commentId = validateCommentId(id);
  const visitorHash = await getVisitorHash(request);

  const comment = await getApprovedComment(env, commentId);
  if (!comment) {
    return commentNotFoundResponse();
  }

  await env.DB.prepare(
    `DELETE FROM comment_likes
    WHERE comment_id = ? AND visitor_hash = ?`,
  )
    .bind(commentId, visitorHash)
    .run();

  const summary = await getLikeSummary(env, commentId, visitorHash);

  return Response.json({
    ok: true,
    commentId,
    likeCount: summary.likeCount,
    liked: false,
  });
}

async function getApprovedComment(env: Env, commentId: string) {
  return await env.DB.prepare(
    `SELECT id
    FROM comments
    WHERE id = ? AND status = ?`,
  )
    .bind(commentId, "approved")
    .first<{ id: string }>();
}

async function getLikeSummary(
  env: Env,
  commentId: string,
  visitorHash: string,
): Promise<LikeSummary> {
  const row = await env.DB.prepare(
    `SELECT
      COUNT(*) AS like_count,
      MAX(CASE WHEN visitor_hash = ? THEN 1 ELSE 0 END) AS liked
    FROM comment_likes
    WHERE comment_id = ?`,
  )
    .bind(visitorHash, commentId)
    .first<{ like_count: number; liked: number | null }>();

  return {
    likeCount: row?.like_count ?? 0,
    liked: row?.liked === 1,
  };
}

function commentNotFoundResponse(): Response {
  return Response.json(
    {
      ok: false,
      message: "评论不存在或不可点赞",
    },
    { status: 404 },
  );
}
