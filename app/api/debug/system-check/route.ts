import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

/**
 * 诊断 API：仅开发环境用于排查数据库与计费模块状态。
 */
export async function GET(): Promise<NextResponse> {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ message: "Not Found" }, { status: 404 });
  }

  try {
    const auth = await requireAdmin();
    if (auth && typeof auth === 'object' && 'status' in auth && 'headers' in auth) {
      return auth as any;
    }

    // Test 1: Prisma connection
    let prisma_ok = false;
    let prisma_error = "";
    try {
      await prisma.$queryRaw`SELECT 1`;
      prisma_ok = true;
    } catch (e: unknown) {
      prisma_error = e instanceof Error ? e.message : String(e);
    }

    // Test 2: PricingSetting table
    let pricing_error = "";
    let pricing_data = null;
    try {
      pricing_data = await prisma.pricingSetting.findMany({});
    } catch (e: unknown) {
      pricing_error = e instanceof Error ? e.message : String(e);
    }

    // Test 3: TransportBill table
    let bills_error = "";
    let bills_count = 0;
    try {
      bills_count = await prisma.transportBill.count();
    } catch (e: unknown) {
      bills_error = e instanceof Error ? e.message : String(e);
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
    } catch (e: unknown) {
      billing_error = e instanceof Error ? e.message : String(e);
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
        node_env: process.env.NODE_ENV ?? "(not set)",
        database_configured: Boolean(process.env.DATABASE_URL?.trim()),
      },
    });
  } catch (error: unknown) {
    return NextResponse.json({
      fatal: true,
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
