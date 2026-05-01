import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const no = searchParams.get("no");

  if (!no) {
    return NextResponse.json(
      { message: "请输入单号" },
      { status: 400 }
    );
  }

  const queryNo = no.trim();

  try {
    // 1. 先尝试在本地数据库查询（湘泰内部单号）
    const bill = await prisma.transportBill.findFirst({
      where: {
        OR: [
          { trackingNumber: queryNo },
          { trackingNumber: queryNo.toUpperCase() },
          { domesticTracking: queryNo },
        ],
      },
      include: {
        statusHistories: {
          orderBy: { createdAt: 'desc' },
        },
        billProducts: true,
      },
    });

    if (bill) {
      // 构造内部运单的返回数据
      return NextResponse.json({
        success: true,
        type: "internal",
        data: {
          id: bill.id,
          trackingNumber: bill.trackingNumber,
          status: bill.shipmentStatus,
          shippingMethod: bill.shippingMethod,
          warehouse: bill.warehouse,
          createdAt: bill.createdAt,
          histories: bill.statusHistories.map(h => ({
            id: h.id,
            status: h.toStatus,
            note: h.note,
            time: h.createdAt,
          })),
        }
      });
    }

    // 2. 如果本地没查到，且单号看起来不像内部单号（比如不是YB开头），则模拟调用第三方快递API
    // 真实场景下这里应该调用快递鸟或快递100的接口
    const isInternalFormat = queryNo.toUpperCase().startsWith("YB");
    if (!isInternalFormat && queryNo.length >= 8) {
      // 模拟第三方快递查询结果
      return NextResponse.json({
        success: true,
        type: "external",
        data: {
          trackingNumber: queryNo,
          company: "第三方快递", // 真实场景会通过 API 识别快递公司
          status: "IN_TRANSIT",
          histories: [
            {
              time: new Date().toISOString(),
              note: `[模拟] 快件已到达【XX转运中心】，准备发往下一站`,
              status: "IN_TRANSIT"
            },
            {
              time: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
              note: `[模拟] 您的快件已被揽收`,
              status: "PICKED_UP"
            }
          ]
        }
      });
    }

    // 3. 查无此单
    return NextResponse.json(
      { success: false, message: "未找到该单号的物流信息" },
      { status: 404 }
    );

  } catch (error) {
    console.error("Public tracking query error:", error);
    return NextResponse.json(
      { success: false, message: "服务器内部异常，请稍后重试" },
      { status: 500 }
    );
  }
}
