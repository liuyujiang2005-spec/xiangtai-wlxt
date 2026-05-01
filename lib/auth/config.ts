/**
 * 读取会话签名密钥，兼容 AUTH_SECRET 与 NEXTAUTH_SECRET。
 */
export function getAuthSecret(): string {
  const authSecret = process.env.AUTH_SECRET?.trim();
  if (authSecret) {
    return authSecret;
  }
  const nextAuthSecret = process.env.NEXTAUTH_SECRET?.trim();
  if (nextAuthSecret) {
    return nextAuthSecret;
  }
  return "development-auth-secret-change-in-production";
}
