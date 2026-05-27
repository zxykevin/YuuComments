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
      id,
      page_path,
      parent_id,
      nickname,
      email,
      email_hash,
      website,
      content,
      status,
      ip,
      created_at,
      updated_at
    FROM comments`;
  const statement = status
    ? env.DB.prepare(`${baseQuery} WHERE status = ? ORDER BY created_at DESC`).bind(
        status,
      )
    : env.DB.prepare(`${baseQuery} ORDER BY created_at DESC`);
  const result = await statement.all<CommentRow>();

  return Response.json({
    ok: true,
    comments: (result.results ?? []).map(toCommentResponse),
  });
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
