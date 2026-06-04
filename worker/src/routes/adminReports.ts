import type {
  AdminReportComment,
  AdminReportItem,
  AdminReportRow,
  Env,
  ReportStatus,
} from "../types";
import { isAdminAuthorized } from "../utils/adminAuth";

type ReportStatusFilter = ReportStatus | "all";

const filterableStatuses = new Set<ReportStatusFilter>([
  "open",
  "resolved",
  "ignored",
  "all",
]);
const mutableStatuses = new Set<ReportStatus>([
  "open",
  "resolved",
  "ignored",
]);

function unauthorizedResponse(): Response {
  return Response.json(
    {
      ok: false,
      message: "未授权",
    },
    { status: 401 },
  );
}

function toReportResponse(row: AdminReportRow): AdminReportItem {
  return {
    id: row.id,
    commentId: row.comment_id,
    reporterEmail: row.reporter_email,
    reason: row.reason,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    comment: toReportComment(row),
  };
}

function toReportComment(row: AdminReportRow): AdminReportComment | null {
  if (!row.comment_id_joined) {
    return null;
  }

  return {
    id: row.comment_id_joined,
    pagePath: row.comment_page_path,
    parentId: row.comment_parent_id,
    nickname: row.comment_nickname,
    email: row.comment_email,
    emailHash: row.comment_email_hash,
    website: row.comment_website,
    content: row.comment_content,
    status: row.comment_status,
    createdAt: row.comment_created_at,
    updatedAt: row.comment_updated_at,
    likeCount: row.like_count ?? 0,
  };
}

export async function getAdminReports(
  request: Request,
  env: Env,
): Promise<Response> {
  if (!isAdminAuthorized(request, env)) {
    return unauthorizedResponse();
  }

  const status =
    (new URL(request.url).searchParams.get("status") as ReportStatusFilter | null) ??
    "open";
  if (!filterableStatuses.has(status)) {
    return Response.json(
      {
        ok: false,
        message: "无效状态",
      },
      { status: 400 },
    );
  }

  const baseQuery = `SELECT
      comment_reports.id,
      comment_reports.comment_id,
      comment_reports.reporter_email,
      comment_reports.reason,
      comment_reports.message,
      comment_reports.status,
      comment_reports.created_at,
      comment_reports.resolved_at,
      comment_reports.resolved_by,
      comments.id AS comment_id_joined,
      comments.page_path AS comment_page_path,
      comments.parent_id AS comment_parent_id,
      comments.nickname AS comment_nickname,
      comments.email AS comment_email,
      comments.email_hash AS comment_email_hash,
      comments.website AS comment_website,
      comments.content AS comment_content,
      comments.status AS comment_status,
      comments.created_at AS comment_created_at,
      comments.updated_at AS comment_updated_at,
      COUNT(comment_likes.visitor_hash) AS like_count
    FROM comment_reports
    LEFT JOIN comments ON comments.id = comment_reports.comment_id
    LEFT JOIN comment_likes ON comment_likes.comment_id = comments.id`;
  const statement =
    status === "all"
      ? env.DB.prepare(
          `${baseQuery}
          GROUP BY comment_reports.id
          ORDER BY comment_reports.created_at DESC`,
        )
      : env.DB.prepare(
          `${baseQuery}
          WHERE comment_reports.status = ?
          GROUP BY comment_reports.id
          ORDER BY comment_reports.created_at DESC`,
        ).bind(status);
  const result = await statement.all<AdminReportRow>();

  return Response.json({
    ok: true,
    reports: (result.results ?? []).map(toReportResponse),
  });
}

export async function updateAdminReportStatus(
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

  const reportId = id.trim();
  const status =
    typeof payload === "object" && payload !== null
      ? (payload as { status?: unknown }).status
      : undefined;
  if (
    !reportId ||
    typeof status !== "string" ||
    !mutableStatuses.has(status as ReportStatus)
  ) {
    return Response.json(
      {
        ok: false,
        message: "无效状态",
      },
      { status: 400 },
    );
  }

  const report = await env.DB.prepare(
    `SELECT id
    FROM comment_reports
    WHERE id = ?
    LIMIT 1`,
  )
    .bind(reportId)
    .first<{ id: string }>();

  if (!report) {
    return Response.json(
      {
        ok: false,
        message: "举报不存在",
      },
      { status: 404 },
    );
  }

  if (status === "open") {
    await env.DB.prepare(
      `UPDATE comment_reports
      SET status = ?, resolved_at = NULL, resolved_by = NULL
      WHERE id = ?`,
    )
      .bind(status, reportId)
      .run();
  } else {
    await env.DB.prepare(
      `UPDATE comment_reports
      SET status = ?, resolved_at = CURRENT_TIMESTAMP, resolved_by = ?
      WHERE id = ?`,
    )
      .bind(status, "admin", reportId)
      .run();
  }

  return Response.json({
    ok: true,
    status,
  });
}
