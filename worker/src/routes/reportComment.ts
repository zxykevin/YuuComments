import type { Env, ReportReason } from "../types";
import { getVisitorHash } from "../utils/visitor";
import { validateCommentId, ValidationError } from "../utils/validate";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REPORT_REASONS = new Set<ReportReason>([
  "spam",
  "abuse",
  "harassment",
  "privacy",
  "illegal",
  "other",
]);
const MAX_EMAIL_LENGTH = 254;
const MAX_MESSAGE_LENGTH = 500;
const AUTO_PENDING_REPORT_COUNT = 5;

interface ReportCommentInput {
  email: string;
  reason: ReportReason;
  message: string | null;
}

export async function reportComment(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const commentId = validateCommentId(id);
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw new Error("INVALID_JSON");
  }

  const input = parseReportCommentInput(payload);
  const comment = await env.DB.prepare(
    `SELECT id, status
    FROM comments
    WHERE id = ? AND status != ?
    LIMIT 1`,
  )
    .bind(commentId, "deleted")
    .first<{ id: string; status: string }>();

  if (!comment) {
    return Response.json(
      {
        ok: false,
        message: "Comment does not exist or cannot be reported.",
      },
      { status: 404 },
    );
  }

  const reporterHash = await getVisitorHash(request);
  const result = await env.DB.prepare(
    `INSERT OR IGNORE INTO comment_reports (
      id,
      comment_id,
      reporter_hash,
      reporter_email,
      reason,
      message
    ) VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      commentId,
      reporterHash,
      input.email,
      input.reason,
      input.message,
    )
    .run();

  if ((result.meta.changes ?? 0) === 0) {
    return Response.json({
      ok: true,
      alreadyReported: true,
    });
  }

  const reportCount = await getReportCount(env, commentId);
  let movedToPending = false;
  if (reportCount >= AUTO_PENDING_REPORT_COUNT && comment.status === "approved") {
    const updateResult = await env.DB.prepare(
      `UPDATE comments
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = ?`,
    )
      .bind("pending", commentId, "approved")
      .run();
    movedToPending = (updateResult.meta.changes ?? 0) > 0;
  }

  return Response.json({
    ok: true,
    reported: true,
    movedToPending,
  });
}

function parseReportCommentInput(payload: unknown): ReportCommentInput {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ValidationError("Request body must be a JSON object.");
  }

  const body = payload as Record<string, unknown>;
  const email = normalizeEmail(body.email);
  const reason = normalizeReason(body.reason);
  const message = normalizeMessage(body.message);

  return {
    email,
    reason,
    message,
  };
}

function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw new ValidationError("email is required.");
  }

  const email = value.trim().toLowerCase();
  if (!email) {
    throw new ValidationError("email is required.");
  }

  if (email.length > MAX_EMAIL_LENGTH) {
    throw new ValidationError("email must be at most 254 characters.");
  }

  if (!EMAIL_PATTERN.test(email)) {
    throw new ValidationError("email format is invalid.");
  }

  return email;
}

function normalizeReason(value: unknown): ReportReason {
  if (typeof value !== "string") {
    throw new ValidationError("reason is invalid.");
  }

  const reason = value.trim();
  if (!REPORT_REASONS.has(reason as ReportReason)) {
    throw new ValidationError("reason is invalid.");
  }

  return reason as ReportReason;
}

function normalizeMessage(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError("message must be a string.");
  }

  const message = value.trim();
  if (!message) {
    return null;
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new ValidationError("message must be at most 500 characters.");
  }

  return message;
}

async function getReportCount(env: Env, commentId: string): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS report_count
    FROM comment_reports
    WHERE comment_id = ?`,
  )
    .bind(commentId)
    .first<{ report_count: number }>();

  return row?.report_count ?? 0;
}