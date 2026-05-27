import { sha256Hex } from "./hash";

export async function getVisitorHash(request: Request): Promise<string> {
  const ip = request.headers.get("CF-Connecting-IP") ?? "";
  const userAgent = request.headers.get("User-Agent") ?? "";
  return await sha256Hex(`${ip}\n${userAgent}`);
}
