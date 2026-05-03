import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isNextResponse } from "@/lib/auth/is-next-response";
import { handleApiError } from "@/lib/api-error";
import { DEFAULT_PRICING, type PricingContent } from "@/lib/pricing-defaults";
import path from "path";
import fs from "fs";

const CONFIG_PATH = path.join(process.cwd(), "data", "pricing-config.json");

/**
 * 读取当前报价单内容（管理员）。
 */
function readConfig(): PricingContent {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
      return JSON.parse(raw) as PricingContent;
    }
  } catch {
    /* 解析失败时回退默认值 */
  }
  return DEFAULT_PRICING;
}

/**
 * 将报价单内容写入磁盘。
 */
function writeConfig(content: PricingContent): void {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(content, null, 2), "utf-8");
}

export async function GET(): Promise<NextResponse> {
  const gate = await requireAdmin();
  if (isNextResponse(gate)) return gate;
  try {
    return NextResponse.json({ content: readConfig() });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  const gate = await requireAdmin();
  if (isNextResponse(gate)) return gate;
  try {
    const body = (await request.json()) as PricingContent;
    // 基本校验
    if (
      typeof body !== "object" ||
      !body ||
      !body.companyName ||
      !body.land ||
      !body.sea
    ) {
      return NextResponse.json(
        { message: "数据格式不正确" },
        { status: 400 }
      );
    }
    writeConfig(body);
    return NextResponse.json({ message: "报价单已保存" });
  } catch (error) {
    return handleApiError(error);
  }
}
