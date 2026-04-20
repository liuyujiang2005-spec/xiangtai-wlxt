import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

/**
 * Diagnostic endpoint - returns detailed system info for debugging 500 errors.
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
    let pricing_count = -1;
    try {
      pricing_count = await prisma.pricingSetting.count();
    } catch (e: any) {
      pricing_error = e?.message ?? String(e);
    }

    // Test 3: TransportBill table
    let bills_error = "";
    let bills_count = -1;
    try {
      bills_count = await prisma.transportBill.count();
    } catch (e: any) {
      bills_error = e?.message ?? String(e);
    }

    // Test 4: User table
    let users_error = "";
    let users_count = -1;
    try {
      users_count = await prisma.user.count();
    } catch (e: any) {
      users_error = e?.message ?? String(e);
    }

    // Test 5: calculateCharge import
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
      pricing_count,
      pricing_error,
      bills_count,
      bills_error,
      users_count,
      users_error,
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
