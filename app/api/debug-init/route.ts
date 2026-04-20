import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function GET(): Promise<NextResponse> {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    // Users
    const users = [
      { id: "usr_admin", username: "admin", passwordHash: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.PQJJvYcAHna3y2", role: "ADMIN", realName: "管理员" },
      { id: "usr_allen", username: "Allen", passwordHash: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.PQJJvYcAHna3y2", role: "STAFF", realName: "Allen Chen" },
      { id: "usr_lyj", username: "lyj", passwordHash: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.PQJJvYcAHna3y2", role: "CLIENT", realName: "刘雨江" },
    ];
    for (const u of users) {
      await prisma.$executeRaw`INSERT OR REPLACE INTO User (id, username, passwordHash, role, realName, isBanned, createdAt, updatedAt)
        VALUES (${u.id}, ${u.username}, ${u.passwordHash}, ${u.role}, ${u.realName}, 0, datetime('now'), datetime('now'))`;
    }

    // PricingSetting
    await prisma.$executeRaw`INSERT OR REPLACE INTO PricingSetting (id, seaPrice, landPrice, createdAt, updatedAt)
      VALUES ('ps_default', 580, 620, datetime('now'), datetime('now'))`;

    // TransportBills - using @map("mark") means actual DB col is "mark"
    const now = new Date().toISOString();
    const ts18 = new Date("2026-04-18").toISOString();
    const ts19 = new Date("2026-04-19").toISOString();
    const ts20 = new Date("2026-04-20").toISOString();

    const bills = [
      { id: "tb01", trackingNumber: "GZ0420001", warehouse: "GUANGZHOU", shippingMethod: "SEA", actualCBM: 2.5, actualWeight: 850, unitPrice: 580, goodsName: "义乌日用品", destinationCountry: "泰国", preOrderStatus: "SIGNED", shipmentStatus: "SIGNED", remark: "客户已签收", totalPackages: 30, estimatedPieces: 25, declaredTotalWeight: 850, declaredTotalVolume: 2.5, clientUserId: "usr_lyj", domesticTracking: "SF1234567890", departureDate: ts18 },
      { id: "tb02", trackingNumber: "GZ0420002", warehouse: "GUANGZHOU", shippingMethod: "SEA", actualCBM: 1.8, actualWeight: 620, unitPrice: 580, goodsName: "电子配件", destinationCountry: "泰国", preOrderStatus: "IN_TRANSIT", shipmentStatus: "IN_TRANSIT", remark: "运输中", totalPackages: 20, estimatedPieces: 15, declaredTotalWeight: 620, declaredTotalVolume: 1.8, clientUserId: "usr_lyj", domesticTracking: "SF9876543210", departureDate: ts19 },
      { id: "tb03", trackingNumber: "SZ0420001", warehouse: "SHENZHEN", shippingMethod: "SEA", actualCBM: 3.2, actualWeight: 1200, unitPrice: 580, goodsName: "服装布料", destinationCountry: "泰国", preOrderStatus: "LOADED", shipmentStatus: "LOADED", remark: "已装柜", totalPackages: 50, estimatedPieces: 40, declaredTotalWeight: 1200, declaredTotalVolume: 3.2, clientUserId: "usr_lyj", domesticTracking: "YT3456789012", departureDate: ts20 },
      { id: "tb04", trackingNumber: "DG0420001", warehouse: "DONGGUAN", shippingMethod: "LAND", actualCBM: 0.8, actualWeight: 300, unitPrice: 620, goodsName: "五金工具", destinationCountry: "老挝", preOrderStatus: "WAREHOUSE_RECEIVED", shipmentStatus: "WAREHOUSE_RECEIVED", remark: "仓库收货", totalPackages: 12, estimatedPieces: 10, declaredTotalWeight: 300, declaredTotalVolume: 0.8, clientUserId: "usr_lyj", domesticTracking: "JS2345678901", departureDate: ts20 },
    ];

    for (const b of bills) {
      await prisma.$executeRaw`INSERT OR REPLACE INTO TransportBill
        (id, trackingNumber, warehouse, shippingMethod, actualCBM, actualWeight, unitPrice,
         isWaived, waivedAmount, isMinChargeWaived, isForecastPending, domesticTracking,
         goodsName, clientUserId, destinationCountry, departureDate,
         preOrderStatus, remark, totalPackages, estimatedPieces,
         declaredTotalWeight, declaredTotalVolume, shipmentStatus, createdAt, updatedAt)
        VALUES (${b.id}, ${b.trackingNumber}, ${b.warehouse}, ${b.shippingMethod},
                ${b.actualCBM}, ${b.actualWeight}, ${b.unitPrice},
                0, 0, 0, 0, ${b.domesticTracking},
                ${b.goodsName}, ${b.clientUserId}, ${b.destinationCountry}, ${b.departureDate},
                ${b.preOrderStatus}, ${b.remark}, ${b.totalPackages}, ${b.estimatedPieces},
                ${b.declaredTotalWeight}, ${b.declaredTotalVolume}, ${b.shipmentStatus}, ${now}, ${now})`;
    }

    const userCount = await prisma.user.count();
    const billCount = await prisma.transportBill.count();
    const pricingCount = await prisma.pricingSetting.count();

    return NextResponse.json({ ok: true, users: userCount, bills: billCount, pricing: pricingCount });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? String(error) }, { status: 500 });
  }
}
