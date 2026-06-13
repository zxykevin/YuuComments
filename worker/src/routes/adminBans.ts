import type { CommentBanRow, Env } from "../types";
import { isAdminAuthorized } from "../utils/adminAuth";

interface AdminBanRow extends CommentBanRow {
  source_comment_content: string | null;
  source_comment_author: string | null;
}

function unauthorizedResponse(): Response {
  return Response.json(
    {
      ok: false,
      message: "Unauthorized.",
    },
    { status: 401 },
  );
}

export async function getAdminBans(
  request: Request,
  env: Env,
): Promise<Response> {
  if (!isAdminAuthorized(request, env)) {
    return unauthorizedResponse();
  }

  const result = await env.DB.prepare(
    `SELECT
      comment_bans.id,
      comment_bans.type,
      comment_bans.value_hash,
      comment_bans.reason,
      comment_bans.source_comment_id,
      comment_bans.created_at,
      comment_bans.expires_at,
      comments.content AS source_comment_content,
      comments.nickname AS source_comment_author
    FROM comment_bans
    LEFT JOIN comments ON comments.id = comment_bans.source_comment_id
    ORDER BY comment_bans.created_at DESC`,
  ).all<AdminBanRow>();

  return Response.json({
    ok: true,
    bans: (result.results ?? []).map((row) => ({
      id: row.id,
      type: row.type,
      valueHash: row.value_hash,
      reason: row.reason,
      sourceCommentId: row.source_comment_id,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      sourceCommentContentPreview: row.source_comment_content?.slice(0, 160) ?? null,
      sourceCommentAuthor: row.source_comment_author,
    })),
  });
}

export async function deleteAdminBan(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  if (!isAdminAuthorized(request, env)) {
    return unauthorizedResponse();
  }

  const result = await env.DB.prepare("DELETE FROM comment_bans WHERE id = ?")
    .bind(id)
    .run();

  if ((result.meta.changes ?? 0) === 0) {
    return Response.json(
      {
        ok: false,
        message: "Ban not found.",
      },
      { status: 404 },
    );
  }

  return Response.json({
    ok: true,
    message: "Source unbanned.",
  });
}
