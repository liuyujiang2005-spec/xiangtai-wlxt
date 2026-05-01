import type { UserRole } from "@/app/generated/prisma/client";
import { getAuthSecret } from "@/lib/auth/config";

/** 会话 Cookie 名称，与 API 设置保持一致。 */
export const SESSION_COOKIE_NAME = "xiangtai_session";

/** 会话有效期（秒），默认 7 天。 */
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

export type SessionPayload = {
  sub: string;
  username: string;
  role: UserRole;
  exp: number;
};

/**
 * 返回会话 Cookie 名称，供中间件与路由统一引用。
 */
export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}

/**
 * 将字节数组编码为 Base64URL 字符串（兼容 Edge 与 Node）。
 */
function uint8ToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * 将 Base64URL 字符串解码为字节数组。
 */
function base64UrlToUint8(value: string): Uint8Array {
  const padded =
    value.replace(/-/g, "+").replace(/_/g, "/") +
    "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

/**
 * 从密钥派生 HMAC-SHA256 所需的 CryptoKey。
 */
async function importHmacKey(secret: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret)
  );
  return crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * 签发会话令牌，内容为 JSON + HMAC 签名，便于中间件无状态校验。
 */
export async function signSessionToken(
  payload: Omit<SessionPayload, "exp"> & { exp?: number },
  secret: string = getAuthSecret()
): Promise<string> {
  const exp =
    payload.exp ?? Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC;
  const body: SessionPayload = { ...payload, exp };
  const data = new TextEncoder().encode(JSON.stringify(body));
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, data);
  const sigBytes = new Uint8Array(signature);
  return `${uint8ToBase64Url(data)}.${uint8ToBase64Url(sigBytes)}`;
}

/**
 * 校验会话令牌签名与过期时间，失败返回 null。
 */
export async function verifySessionToken(
  token: string,
  secret: string = getAuthSecret()
): Promise<SessionPayload | null> {
  try {
    const dot = token.indexOf(".");
    if (dot <= 0) {
      return null;
    }
    const payloadPart = token.slice(0, dot);
    const sigPart = token.slice(dot + 1);
    const data = base64UrlToUint8(payloadPart);
    const signature = base64UrlToUint8(sigPart);
    const key = await importHmacKey(secret);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature as BufferSource,
      data as BufferSource
    );
    if (!valid) {
      return null;
    }
    const parsed = JSON.parse(new TextDecoder().decode(data)) as SessionPayload;
    if (
      typeof parsed.exp !== "number" ||
      parsed.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    if (!parsed.sub || !parsed.username || !parsed.role) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
