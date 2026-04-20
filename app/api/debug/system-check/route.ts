import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

/**
 * 诊断 API：暴露真实错误信息，帮助调试 500 问题。
 */
export async function GET(): Promise<NextResponse> {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) {
      return auth;
    }

    // Test 1: Prisma connection
    let prisma_ok = false;
    let prisma_error = "";
    try {
      await prisma.$queryRaw`SELECT 1`;
      prisma_ok = true;
    } catch (e: any) {
      prisma_error = e?.message ?? String(e);
    }

    // Test 2: PricingSetting table
    let pricing_error = "";
    let pricing_data = null;
    try {
      pricing_data = await prisma.prisma pricingSetting.findMany({});
    } catch (e: any) {
      pricing_error = e?.message ?? String(e);
    }

    // Test 3: TransportBill table
    let bills_error = "";
    let bills_count = 0;
    try {
      bills_count = await prisma.transportBill.count();
    } catch (e: any) {
      bills_error = e?.message ?? String(e);
    }

    // Test 4: calculateCharge import
    let billing_ok = false;
    let billing_error = "";
    try {
      const { calculateCharge } = await import("@/lib/core/charge-formulas");
      const r = calculateCharge({
        shippingMethod: "SEA",
        actualCBM: 0.8,
        unitPrice: 580,
        isMinChargeWaived: false,
      });
      billing_ok = true;
    } catch (e: any) {
      billing_error = e?.message ?? String(e);
    }

    return NextResponse.json({
      prisma_ok,
      prisma_error,
      pricing_error,
      pricing_data: pricing_data ? `count=${(pricing_data as any[]).length}` : null,
      bills_error,
      bills_count,
      billing_ok,
      billing_error,
      env: {
        database_url: process.env.DATABASE_URL ?? "(not set)",
        node_env: process.env.NODE_ENV ?? "(not set)",
        cwd: process.cwd(),
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      fatal: true,
      message: error?.message ?? String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}