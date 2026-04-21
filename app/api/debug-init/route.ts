import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * 公开的数据库初始化端点。
 * 在 prisma db push --force-reset 后，访问此端点即可恢复种子数据。
 * 无需认证，每次部署后只需访问一次即可。
 */
export async function GET(): Promise<NextResponse> {
  try {
    const [users, pricing, bills] = await Promise.all([
      prisma.user.findMany({ select: { id: true, username: true, role: true } }),
      prisma.pricingSetting.findMany({ select: { id: true, seaPrice: true, landPrice: true } }),
      prisma.transportBill.findMany({
        select: { id: true, trackingNumber: true, status: true },
        take: 10,
      }),
    ]);
    return NextResponse.json({ ok: true, users, pricing, bills });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(): Promise<NextResponse> {
  try {
    // 1. Seed users (3 accounts, admin/Allen/lyj)
    const H = "$2b$12$Qf7G4Xdvj7movagIZxfUde8kG.nzE1VSjUabO00cd/7g5n.c0dvRW";
    const seedUsers = [
      { id: "usr_admin", username: "admin",  passwordHash: H, role: "ADMIN",  realName: "管理员"    },
      { id: "usr_allen", username: "Allen", passwordHash: H, role: "STAFF",  realName: "Allen Chen" },
      { id: "usr_lyj",   username: "lyj",    passwordHash: H, role: "CLIENT", realName: "刘宇"      },
    ];
    for (const u of seedUsers) {
      await prisma.$executeRaw`
        INSERT OR REPLACE INTO User
          (id, username, passwordHash, role, realName, isBanned, discountRate, createdAt, updatedAt)
        VALUES (${u.id}, ${u.username}, ${u.passwordHash}, ${u.role},
                ${u.realName}, 0, 1.0, datetime('now'), datetime('now'))
      `;
    }

    // 2. Seed pricing
    await prisma.$executeRaw`
      INSERT OR REPLACE INTO PricingSetting
        (id, seaPrice, landPrice, updatedById, createdAt, updatedAt)
      VALUES ('prc_default', 2800.00, 1800.00, 'usr_admin', datetime('now'), datetime('now'))
    `;

    // 3. Seed sample transport bills using correct schema columns
    const bills = [
      {
        id: "xtb_001",
        trackingNumber: "XT202504001",
        warehouse: "SHENZHEN",
        shippingMethod: "海运",
        goodsName: "电子元器件",
        actualCBM: 3.2,
        actualWeight: 156.5,
        unitPrice: 2800.00,
        destinationCountry: "香港",
        departureDate: "2025-04-18",
        preOrderStatus: "PRE_ALERT",
        shipmentStatus: "SHIPPED",
        totalPackages: 20,
        declaredTotalWeight: 156.5,
        declaredTotalVolume: 3.2,
        shippingMark: "XT202504001",
      },
      {
        id: "xtb_002",
        trackingNumber: "XT202504002",
        warehouse: "GUANGZHOU",
        shippingMethod: "海运",
        goodsName: "服装成品",
        actualCBM: 8.5,
        actualWeight: 89.0,
        unitPrice: 2800.00,
        destinationCountry: "澳门",
        departureDate: "2025-04-19",
        preOrderStatus: "PRE_ALERT",
        shipmentStatus: "PRE_ALERT",
        totalPackages: 500,
        declaredTotalWeight: 89.0,
        declaredTotalVolume: 8.5,
        shippingMark: "XT202504002",
      },
      {
        id: "xtb_003",
        trackingNumber: "XT202504003",
        warehouse: "DONGGUAN",
        shippingMethod: "海运",
        goodsName: "机械设备配件",
        actualCBM: 2.8,
        actualWeight: 320.0,
        unitPrice: 2800.00,
        destinationCountry: "香港",
        departureDate: "2025-04-20",
        preOrderStatus: "PRE_ALERT",
        shipmentStatus: "ARRIVED_FULL",
        totalPackages: 5,
        declaredTotalWeight: 320.0,
        declaredTotalVolume: 2.8,
        shippingMark: "XT202504003",
      },
      {
        id: "xtb_004",
        trackingNumber: "XT202504004",
        warehouse: "FOSHAN",
        shippingMethod: "海运",
        goodsName: "卫浴陶瓷",
        actualCBM: 12.0,
        actualWeight: 450.0,
        unitPrice: 2800.00,
        destinationCountry: "澳门",
        departureDate: "2025-04-21",
        preOrderStatus: "PRE_ALERT",
        shipmentStatus: "PRE_ALERT",
        totalPackages: 100,
        declaredTotalWeight: 450.0,
        declaredTotalVolume: 12.0,
        shippingMark: "XT202504004",
      },
    ];
    for (const b of bills) {
      await prisma.$executeRaw`
        INSERT OR REPLACE INTO TransportBill (
          id, trackingNumber, warehouse, shippingMethod, goodsName,
          actualCBM, actualWeight, unitPrice,
          destinationCountry, departureDate,
          preOrderStatus, shipmentStatus,
          totalPackages, declaredTotalWeight, declaredTotalVolume,
          shippingMark, isWaived, isMinChargeWaived, isForecastPending,
          domesticTracking, containerTruckNo,
          createdAt, updatedAt
        ) VALUES (
          ${b.id}, ${b.trackingNumber}, ${b.warehouse}, ${b.shippingMethod},
          ${b.goodsName}, ${b.actualCBM}, ${b.actualWeight}, ${b.unitPrice},
          ${b.destinationCountry}, ${b.departureDate},
          ${b.preOrderStatus}, ${b.shipmentStatus},
          ${b.totalPackages}, ${b.declaredTotalWeight}, ${b.declaredTotalVolume},
          ${b.shippingMark}, 0, 0, 0,
          '', '', datetime('now'), datetime('now')
        )
      `;
    }

    return NextResponse.json({
      ok: true,
      users: seedUsers.length,
      pricing: 1,
      transportBills: bills.length,
      message: `OK: ${seedUsers.length} users + 1 pricing + ${bills.length} bills`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[debug-init] error:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
