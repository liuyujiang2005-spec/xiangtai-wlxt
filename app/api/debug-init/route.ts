import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * 公开的数据库初始化端点。
 * 在 prisma db push --force-reset 后，访问此端点即可恢复种子数据。
 * 无需认证，每次部署后只需访问一次。
 *
 * POST /api/debug-init — 初始化所有种子数据（users + pricing + sample bills）
 * GET  /api/debug-init — 查询当前种子数据状态
 */
export async function GET(): Promise<NextResponse> {
  try {
    const users = await prisma.$queryRaw`
      SELECT id, username, role FROM User ORDER BY createdAt
    `;
    const pricing = await prisma.$queryRaw`
      SELECT id, seaPrice, landPrice FROM PricingSetting LIMIT 1
    `;
    const bills = await prisma.$queryRaw`
      SELECT id, billNo, status FROM TransportBill ORDER BY createdAt LIMIT 10
    `;
    return NextResponse.json({
      status: "ok",
      seeded: true,
      data: {
        users: users as { id: string; username: string; role: string }[],
        pricing: pricing as { id: string; seaPrice: number; landPrice: number }[],
        transportBills: bills as { id: string; billNo: string; status: string }[],
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ status: "error", message: msg }, { status: 500 });
  }
}

export async function POST(): Promise<NextResponse> {
  try {
    // 1. Seed users (3 accounts)
    const H = "$2b$12$Qf7G4Xdvj7movagIZxfUde8kG.nzE1VSjUabO00cd/7g5n.c0dvRW";
    const seedUsers = [
      { id: "usr_admin", username: "admin",     passwordHash: H, role: "ADMIN",  realName: "管理员"  },
      { id: "usr_allen", username: "Allen",    passwordHash: H, role: "STAFF",  realName: "Allen Chen" },
      { id: "usr_lyj",   username: "lyj",      passwordHash: H, role: "CLIENT", realName: "刘宇"    },
    ];
    for (const u of seedUsers) {
      await prisma.$executeRaw`
        INSERT OR REPLACE INTO User (id, username, passwordHash, role, realName, createdAt, updatedAt)
        VALUES (${u.id}, ${u.username}, ${u.passwordHash}, ${u.role}, ${u.realName}, datetime('now'), datetime('now'))
      `;
    }

    // 2. Seed pricing
    await prisma.$executeRaw`
      INSERT OR REPLACE INTO PricingSetting (id, seaPrice, landPrice, updatedById, createdAt, updatedAt)
      VALUES ('prc_default', 2800.00, 1800.00, 'usr_admin', datetime('now'), datetime('now'))
    `;

    // 3. Seed sample transport bills (湘泰物流真实场景)
    const bills = [
      {
        id: "xtb_001",
        billNo: "XT202504001",
        shipper: "深圳华强电子有限公司",
        consignee: "香港新界仓库",
        cargoDesc: "电子元器件 x20箱",
        weight: 156.5,
        volume: 3.2,
        seaPrice: 2800.00,
        landPrice: 1800.00,
        warehouse: "SHENZHEN",
        portOfDeparture: "深圳盐田港",
        destination: "香港",
        shippingDate: "2025-04-18",
        status: "SHIPPED",
      },
      {
        id: "xtb_002",
        billNo: "XT202504002",
        shipper: "广州白云服装厂",
        consignee: "澳门半岛客户",
        cargoDesc: "服装成品 x500件",
        weight: 89.0,
        volume: 8.5,
        seaPrice: 2800.00,
        landPrice: 1800.00,
        warehouse: "GUANGZHOU",
        portOfDeparture: "广州南沙港",
        destination: "澳门",
        shippingDate: "2025-04-19",
        status: "PRE_ALERT",
      },
      {
        id: "xtb_003",
        billNo: "XT202504003",
        shipper: "东莞精密机械厂",
        consignee: "香港葵涌物流中心",
        cargoDesc: "机械设备配件 x5件",
        weight: 320.0,
        volume: 2.8,
        seaPrice: 2800.00,
        landPrice: 1800.00,
        warehouse: "DONGGUAN",
        portOfDeparture: "深圳盐田港",
        destination: "香港",
        shippingDate: "2025-04-20",
        status: "ARRIVED_FULL",
      },
      {
        id: "xtb_004",
        billNo: "XT202504004",
        shipper: "佛山陶瓷卫浴公司",
        consignee: "澳门工程部",
        cargoDesc: "卫浴陶瓷 x100件",
        weight: 450.0,
        volume: 12.0,
        seaPrice: 2800.00,
        landPrice: 1800.00,
        warehouse: "FOSHAN",
        portOfDeparture: "广州南沙港",
        destination: "澳门",
        shippingDate: "2025-04-21",
        status: "PRE_ALERT",
      },
    ];
    for (const b of bills) {
      await prisma.$executeRaw`
        INSERT OR REPLACE INTO TransportBill (
          id, billNo, shipper, consignee, cargoDesc, weight, volume,
          seaPrice, landPrice, warehouse, portOfDeparture, destination,
          shippingDate, status, mark, createdAt, updatedAt
        ) VALUES (
          ${b.id}, ${b.billNo}, ${b.shipper}, ${b.consignee}, ${b.cargoDesc},
          ${b.weight}, ${b.volume}, ${b.seaPrice}, ${b.landPrice}, ${b.warehouse},
          ${b.portOfDeparture}, ${b.destination}, ${b.shippingDate}, ${b.status},
          ${b.billNo}, datetime('now'), datetime('now')
        )
      `;
    }

    return NextResponse.json({
      status: "ok",
      seeded: true,
      users: seedUsers.length,
      pricing: 1,
      transportBills: bills.length,
      message: `已初始化：${seedUsers.length}个用户 + 1个定价 + ${bills.length}条运单`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[debug-init] seed error:", msg);
    return NextResponse.json({ status: "error", message: msg }, { status: 500 });
  }
}
