import { cookies } from "next/headers";
import { getAuthSecret } from "@/lib/auth/config";
import {
  getSessionCookieName,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/auth/session-token";

/**
 * 在 Server Component 或 Route Handler 中读取当前登录会话。
 */
export async function getServerSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(getSessionCookieName())?.value;
  if (!token) {
    return null;
  }
  return verifySessionToken(token, getAuthSecret());
}
