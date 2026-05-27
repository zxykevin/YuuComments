import type { CreateCommentInput } from "../types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class ValidationError extends Error {}

export function validatePagePath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/")) {
    throw new ValidationError("path 必须存在且以 / 开头");
  }

  return value;
}

export function validateCommentId(value: string | null | undefined): string {
  const id = value?.trim() ?? "";

  if (!id) {
    throw new ValidationError("commentId 必须存在");
  }

  return id;
}

function normalizeOptionalString(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError("可选字段必须是字符串");
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function validateWebsite(value: string | null): string | null {
  if (!value) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ValidationError("website 必须是合法 URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ValidationError("website 只允许 http 或 https");
  }

  return url.toString();
}

function validateEmail(value: string | null): string | null {
  if (!value) {
    return null;
  }

  if (!EMAIL_PATTERN.test(value)) {
    throw new ValidationError("email 格式不正确");
  }

  return value.toLowerCase();
}

export function parseCreateCommentInput(payload: unknown): CreateCommentInput {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ValidationError("请求体必须是 JSON 对象");
  }

  const body = payload as Record<string, unknown>;
  const pagePath = validatePagePath(
    typeof body.pagePath === "string" ? body.pagePath.trim() : null,
  );
  const parentId = normalizeOptionalString(body.parentId);
  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
  const email = validateEmail(normalizeOptionalString(body.email));
  const website = validateWebsite(normalizeOptionalString(body.website));
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const turnstileToken =
    typeof body.turnstileToken === "string" ? body.turnstileToken.trim() : "";

  if (nickname.length < 1 || nickname.length > 30) {
    throw new ValidationError("nickname 长度必须在 1 到 30 之间");
  }

  if (content.length < 1 || content.length > 1000) {
    throw new ValidationError("content 长度必须在 1 到 1000 之间");
  }

  return {
    pagePath,
    parentId,
    nickname,
    email,
    website,
    content,
    turnstileToken,
  };
}
