/**
 * 读取会话签名密钥，生产环境务必配置 AUTH_SECRET。
 */
export function getAuthSecret(): string {
  return (
    process.env.AUTH_SECRET ?? "development-auth-secret-change-in-production"
  );
}
