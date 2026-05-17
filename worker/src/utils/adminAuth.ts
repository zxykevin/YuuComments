import type { Env } from "../types";

export function isAdminAuthorized(request: Request, env: Env): boolean {
  const token = env.ADMIN_TOKEN;
  if (!token) return false;

  return request.headers.get("Authorization") === `Bearer ${token}`;
}
