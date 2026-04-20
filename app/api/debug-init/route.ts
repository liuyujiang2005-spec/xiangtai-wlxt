import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function GET(): Promise<NextResponse> {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    await prisma.user.upsert({
      where: { username: "admin" },
      create: { id: "usr_admin", username: "admin",
        passwordHash: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.PQJJvYcAHna3y2",
        role: "ADMIN", realName: "管理员"
      }, update: {}
    });
    await prisma.user.upsert({
      where: { username: "Allen" },
      create: { id: "usr_allen", username: "Allen",
        passwordHash: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.PQJJvYcAHna3y2",
        role: "STAFF", realName: "Allen Chen"
      }, update: {}
    });
    await prisma.user.upsert({
      where: { username: "lyj" },
      create: { id: "usr_lyj", username: "lyj",
        passwordHash: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.PQJJvYcAHna3y2",
        role: "CLIENT", realName: "刘雨江"
      }, update: {}
    });

    await prisma.pricingSetting.upsert({
      where: { id: "ps_default" },
      create: { id: "ps_default", seaPrice: 580, landPrice: 620 },
      update: {}
    });

    const bills = [
      { id: "tb01", trackingNumber: "GZ0420001", warehouse: "GUANGZHOU", shippingMethod: "SEA",
        actualCBM: 2.5, actualWeight: 850, unitPrice: 580, goodsName: "义乌日用品",
        destinationCountry: "泰国", preOrderStatus: "SIGNED", shipmentStatus: "SIGNED",
        remark: "客户已签收", totalPackages: 30, estimatedPieces: 25,
        declaredTotalWeight: 850, declaredTotalVolume: 2.5,
        clientUserId: "usr_lyj", domesticTracking: "SF1234567890",
        departureDate: new Date("2026-04-18"), isMinChargeWaived: false, isForecastPending: false,
        isWaived: false, waivedAmount: 0 },
      { id: "tb02", trackingNumber: "GZ0420002", warehouse: "GUANGZHOU", shippingMethod: "SEA",
        actualCBM: 1.8, actualWeight: 620, unitPrice: 580, goodsName: "电子配件",
        destinationCountry: "泰国", preOrderStatus: "IN_TRANSIT", shipmentStatus: "IN_TRANSIT",
        remark: "运输中", totalPackages: 20, estimatedPieces: 15,
        declaredTotalWeight: 620, declaredTotalVolume: 1.8,
        clientUserId: "usr_lyj", domesticTracking: "SF9876543210",
        departureDate: new Date("2026-04-19"), isMinChargeWaived: false, isForecastPending: false,
        isWaived: false, waivedAmount: 0 },
      { id: "tb03", trackingNumber: "SZ0420001", warehouse: "SHENZHEN", shippingMethod: "SEA",
        actualCBM: 3.2, actualWeight: 1200, unitPrice: 580, goodsName: "服装布料",
        destinationCountry: "泰国", preOrderStatus: "LOADED", shipmentStatus: "LOADED",
        remark: "已装柜", totalPackages: 50, estimatedPieces: 40,
        declaredTotalWeight: 1200, declaredTotalVolume: 3.2,
        clientUserId: "usr_lyj", domesticTracking: "YT3456789012",
        departureDate: new Date("2026-04-20"), isMinChargeWaived: false, isForecastPending: false,
        isWaived: false, waivedAmount: 0 },
      { id: "tb04", trackingNumber: "DG0420001", warehouse: "DONGGUAN", shippingMethod: "LAND",
        actualCBM: 0.8, actualWeight: 300, unitPrice: 620, goodsName: "五金工具",
        destinationCountry: "老挝", preOrderStatus: "WAREHOUSE_RECEIVED", shipmentStatus: "WAREHOUSE_RECEIVED",
        remark: "仓库收货", totalPackages: 12, estimatedPieces: 10,
        declaredTotalWeight: 300, declaredTotalVolume: 0.8,
        clientUserId: "usr_lyj", domesticTracking: "JS2345678901",
        departureDate: new Date("2026-04-20"), isMinChargeWaived: false, isForecastPending: false,
        isWaived: false, waivedAmount: 0 },
    ];

    for (const bill of bills) {
      await prisma.transportBill.upsert({
        where: { id: bill.id },
        create: bill,
        update: {}
      });
    }

    const users = await prisma.user.count();
    const bills2 = await prisma.transportBill.count();
    const pricing = await prisma.pricingSetting.count();

    return NextResponse.json({ ok: true, users, bills: bills2, pricing });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? String(error) }, { status: 500 });
  }
}
