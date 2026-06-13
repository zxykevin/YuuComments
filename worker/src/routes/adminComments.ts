import type {
  AdminCommentResponse,
  CommentRow,
  CommentStatus,
  Env,
} from "../types";
import { isAdminAuthorized } from "../utils/adminAuth";

const filterableStatuses = new Set<CommentStatus>([
  "pending",
  "approved",
  "spam",
  "deleted",
]);
const mutableStatuses = new Set<CommentStatus>([
  "pending",
  "approved",
  "spam",
]);

function toCommentResponse(row: CommentRow): AdminCommentResponse {
  return {
    id: row.id,
    pagePath: row.page_path,
    parentId: row.parent_id,
    nickname: row.nickname,
    email: row.email,
    emailHash: row.email_hash,
    website: row.website,
    content: row.content,
    status: row.status,
    ip: row.ip,
    ipHash: row.ip_hash,
    deviceFingerprint: row.device_fingerprint,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    likeCount: row.like_count ?? 0,
    liked: row.liked === 1,
  };
}

function unauthorizedResponse(): Response {
  return Response.json(
    {
      ok: false,
      message: "未授权",
    },
    { status: 401 },
  );
}

export async function getAdminComments(
  request: Request,
  env: Env,
): Promise<Response> {
  if (!isAdminAuthorized(request, env)) {
    return unauthorizedResponse();
  }

  const status = new URL(request.url).searchParams.get("status");
  if (status && !filterableStatuses.has(status as CommentStatus)) {
    return Response.json(
      {
        ok: false,
        message: "无效状态",
      },
      { status: 400 },
    );
  }

  const baseQuery = `SELECT
      comments.id,
      comments.page_path,
      comments.parent_id,
      comments.nickname,
      comments.email,
      comments.email_hash,
      comments.website,
      comments.content,
      comments.status,
      comments.ip,
      comments.ip_hash,
      comments.device_fingerprint,
      comments.created_at,
      comments.updated_at,
      COUNT(comment_likes.visitor_hash) AS like_count
    FROM comments
    LEFT JOIN comment_likes ON comment_likes.comment_id = comments.id`;
  const statement = status
    ? env.DB.prepare(
        `${baseQuery}
        WHERE comments.status = ?
        GROUP BY comments.id
        ORDER BY comments.created_at DESC`,
      ).bind(status)
    : env.DB.prepare(
        `${baseQuery}
        GROUP BY comments.id
        ORDER BY comments.created_at DESC`,
      );
  let result: D1Result<CommentRow>;
  try {
    result = await statement.all<CommentRow>();
  } catch (error) {
    if (isMissingCommentLikesTableError(error)) {
      return Response.json(
        {
          ok: false,
          message: "点赞数据表不存在，请先执行 D1 migration。",
        },
        { status: 500 },
      );
    }

    throw error;
  }

  return Response.json({
    ok: true,
    comments: (result.results ?? []).map(toCommentResponse),
  });
}

function isMissingCommentLikesTableError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /comment_likes/i.test(error.message) &&
    /no such table|not found|does not exist/i.test(error.message)
  );
}

export async function updateAdminCommentStatus(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  if (!isAdminAuthorized(request, env)) {
    return unauthorizedResponse();
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw new Error("INVALID_JSON");
  }

  const status =
    typeof payload === "object" && payload !== null
      ? (payload as { status?: unknown }).status
      : undefined;
  if (typeof status !== "string" || !mutableStatuses.has(status as CommentStatus)) {
    return Response.json(
      {
        ok: false,
        message: "无效状态",
      },
      { status: 400 },
    );
  }

  const result = await env.DB.prepare(
    `UPDATE comments
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`,
  )
    .bind(status, id)
    .run();

  if ((result.meta.changes ?? 0) === 0) {
    return Response.json(
      {
        ok: false,
        message: "评论不存在",
      },
      { status: 404 },
    );
  }

  return Response.json({
    ok: true,
    status,
  });
}

export async function spamAndBanAdminComment(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  if (!isAdminAuthorized(request, env)) {
    return unauthorizedResponse();
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw new Error("INVALID_JSON");
  }

  const body =
    typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)
      : {};
  const banIp = body.banIp === true;
  const banDevice = body.banDevice === true;
  const reason =
    typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim().slice(0, 500)
      : "Spam comment";

  if (!banIp && !banDevice) {
    return Response.json(
      {
        ok: false,
        message: "Select at least one ban target.",
      },
      { status: 400 },
    );
  }

  const comment = await env.DB.prepare(
    `SELECT id, ip_hash, device_fingerprint
    FROM comments
    WHERE id = ?
    LIMIT 1`,
  )
    .bind(id)
    .first<{
      id: string;
      ip_hash: string | null;
      device_fingerprint: string | null;
    }>();

  if (!comment) {
    return Response.json(
      {
        ok: false,
        message: "Comment not found.",
      },
      { status: 404 },
    );
  }

  const statements = [
    env.DB.prepare(
      `UPDATE comments
      SET status = 'spam', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    ).bind(id),
  ];

  if (banIp && comment.ip_hash) {
    statements.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO comment_bans (
          id, type, value_hash, reason, source_comment_id
        ) VALUES (?, 'ip', ?, ?, ?)`,
      ).bind(crypto.randomUUID(), comment.ip_hash, reason, id),
    );
  }

  if (banDevice && comment.device_fingerprint) {
    statements.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO comment_bans (
          id, type, value_hash, reason, source_comment_id
        ) VALUES (?, 'device', ?, ?, ?)`,
      ).bind(crypto.randomUUID(), comment.device_fingerprint, reason, id),
    );
  }

  await env.DB.batch(statements);

  const bans = {
    ip: banIp && Boolean(comment.ip_hash),
    device: banDevice && Boolean(comment.device_fingerprint),
  };
  const skipped = [
    banIp && !comment.ip_hash ? "IP hash unavailable" : null,
    banDevice && !comment.device_fingerprint
      ? "Device fingerprint unavailable"
      : null,
  ].filter((message): message is string => Boolean(message));

  return Response.json({
    ok: true,
    status: "spam",
    bans,
    skipped,
    message:
      skipped.length > 0
        ? `Comment marked as spam. Skipped: ${skipped.join(", ")}.`
        : "Comment marked as spam and source banned.",
  });
}

export async function deleteAdminComment(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  if (!isAdminAuthorized(request, env)) {
    return unauthorizedResponse();
  }

  const comment = await env.DB.prepare(
    `SELECT id
    FROM comments
    WHERE id = ?`,
  )
    .bind(id)
    .first<{ id: string }>();

  if (!comment) {
    return Response.json(
      {
        ok: false,
        message: "评论不存在",
      },
      { status: 404 },
    );
  }

  await env.DB.prepare("DELETE FROM comments WHERE id = ?").bind(id).run();

  return Response.json({
    ok: true,
    message: "评论已永久删除",
  });
}
