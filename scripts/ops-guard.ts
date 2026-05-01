/**
 * 对高风险本地运维脚本做二次确认，避免误操作或误用于生产。
 */
export function ensureLocalOpsAllowed(operationName: string): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${operationName} 不允许在生产环境执行。`);
  }

  if (process.env.ACCOUNT_OPS_CONFIRM !== "YES") {
    throw new Error(
      `${operationName} 需要显式确认。请先设置环境变量 ACCOUNT_OPS_CONFIRM=YES。`
    );
  }
}
