import type { CommentStatus, Env } from "../types";
import { sha256Hex } from "../utils/hash";
import { verifyTurnstileToken } from "../utils/turnstile";
import { parseCreateCommentInput } from "../utils/validate";

const DEFAULT_COMMENT_STATUS: CommentStatus = "approved";

export async function createComment(request: Request, env: Env): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw new Error("INVALID_JSON");
  }

  const input = parseCreateCommentInput(payload);
  const ip = request.headers.get("CF-Connecting-IP");
  const hostname = new URL(request.url).hostname;
  const allowDevBypass = hostname === "localhost" || hostname === "127.0.0.1";
  const verified = await verifyTurnstileToken(
    input.turnstileToken,
    env.TURNSTILE_SECRET_KEY,
    ip,
    allowDevBypass,
  );

  if (!verified) {
    return Response.json(
      {
        ok: false,
        message: "人机验证失败",
      },
      { status: 400 },
    );
  }

  if (input.parentId) {
    const parent = await env.DB.prepare(
      "SELECT id, page_path FROM comments WHERE id = ? LIMIT 1",
    )
      .bind(input.parentId)
      .first<{ id: string; page_path: string }>();

    if (!parent || parent.page_path !== input.pagePath) {
      return Response.json(
        {
          ok: false,
          message: "parentId 对应的评论不存在",
        },
        { status: 400 },
      );
    }
  }

  const id = crypto.randomUUID();
  const emailHash = input.email ? await sha256Hex(input.email) : null;
  const ipHash = ip ? await sha256Hex(ip) : null;

  await env.DB.prepare(
    `INSERT INTO comments (
      id,
      page_path,
      parent_id,
      nickname,
      email,
      email_hash,
      website,
      content,
      status,
      user_agent,
      ip_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      input.pagePath,
      input.parentId,
      input.nickname,
      input.email,
      emailHash,
      input.website,
      input.content,
      DEFAULT_COMMENT_STATUS,
      request.headers.get("User-Agent"),
      ipHash,
    )
    .run();

  return Response.json({
    ok: true,
    status: DEFAULT_COMMENT_STATUS,
    message: "评论已提交，等待审核",
  });
}
