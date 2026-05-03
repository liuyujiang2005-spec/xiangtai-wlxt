import { NextResponse } from "next/server";
import { DEFAULT_PRICING, type PricingContent } from "@/lib/pricing-defaults";
import path from "path";
import fs from "fs";

const CONFIG_PATH = path.join(process.cwd(), "data", "pricing-config.json");

/**
 * 公开接口：返回当前生效的头程报价内容（无需登录）。
 */
export async function GET(): Promise<NextResponse> {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
      const content = JSON.parse(raw) as PricingContent;
      return NextResponse.json({ content });
    }
  } catch {
    /* 回退默认值 */
  }
  return NextResponse.json({ content: DEFAULT_PRICING });
}
