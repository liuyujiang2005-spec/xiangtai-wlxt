import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

/**
 * 快递100实时查询签名：MD5(param字符串 + key + customer).toUpperCase()
 */
function kuaidi100Sign(param: string, key: string, customer: string): string {
  return crypto
    .createHash("md5")
    .update(param + key + customer)
    .digest("hex")
    .toUpperCase();
}

/**
 * 调用快递100自动识别快递公司接口。
 * 返回 comCode（如 "shunfeng"），失败返回 null。
 */
async function detectCourier(num: string): Promise<string | null> {
  try {
    const url = `https://www.kuaidi100.com/autonumber/autoComNum?text=${encodeURIComponent(num)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const json = (await res.json()) as Array<{ comCode: string }>;
    return Array.isArray(json) && json.length > 0 ? json[0].comCode : null;
  } catch {
    return null;
  }
}

type Kuaidi100Data = {
  time: string;
  ftime: string;
  context: string;
  location?: string;
  status?: string;
};

type Kuaidi100Response = {
  message: string;
  nu: string;
  ischeck: string;
  com: string;
  status: string;
  state: string;
  data: Kuaidi100Data[];
};

/**
 * 调用快递100实时查询接口。
 */
async function queryKuaidi100(
  num: string,
  comCode: string,
  customer: string,
  key: string
): Promise<Kuaidi100Response | null> {
  try {
    const param = JSON.stringify({ com: comCode, num, resultv2: "1" });
    const sign = kuaidi100Sign(param, key, customer);
    const body = new URLSearchParams({ customer, sign, param });
    const res = await fetch("https://poll.kuaidi100.com/poll/query.do", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return (await res.json()) as Kuaidi100Response;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const no = searchParams.get("no");

  if (!no) {
    return NextResponse.json({ message: "请输入单号" }, { status: 400 });
  }

  const queryNo = no.trim();

  try {
    // ── 1. 优先查询本地数据库（湘泰内部运单 / 预报单）────────────────────────
    const bill = await prisma.transportBill.findFirst({
      where: {
        OR: [
          { trackingNumber: queryNo },
          { trackingNumber: queryNo.toUpperCase() },
          { domesticTracking: queryNo },
        ],
      },
      include: {
        statusHistories: { orderBy: { createdAt: "desc" } },
        billProducts: true,
      },
    });

    if (bill) {
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
          histories: bill.statusHistories.map((h) => ({
            id: h.id,
            status: h.toStatus,
            note: h.note,
            time: h.createdAt,
          })),
        },
      });
    }

    // ── 2. 调用快递100查询中国国内快递轨迹 ──────────────────────────────────
    const customer = process.env.KUAIDI100_CUSTOMER ?? "";
    const key = process.env.KUAIDI100_KEY ?? "";

    if (customer && key) {
      // 自动识别快递公司
      const comCode = await detectCourier(queryNo);

      if (comCode) {
        const result = await queryKuaidi100(queryNo, comCode, customer, key);

        if (result && result.status === "200" && Array.isArray(result.data)) {
          return NextResponse.json({
            success: true,
            type: "external",
            source: "kuaidi100",
            data: {
              trackingNumber: queryNo,
              company: comCode,
              state: result.state,
              histories: result.data.map((d) => ({
                time: d.ftime || d.time,
                note: d.context,
                location: d.location ?? "",
              })),
            },
          });
        }

        // 快递100返回但无数据（如单号格式不符）
        if (result && result.message && result.message !== "ok") {
          return NextResponse.json(
            { success: false, message: `快递100：${result.message}` },
            { status: 404 }
          );
        }
      }

      // 识别不到快递公司，或接口无数据
      return NextResponse.json(
        {
          success: false,
          message: "快递100暂无该单号的轨迹信息，请确认单号是否正确，或稍后再查。",
        },
        { status: 404 }
      );
    }

    // ── 3. 未配置快递100凭证 ────────────────────────────────────────────────
    return NextResponse.json(
      {
        success: false,
        message:
          "快递100接口暂未配置（请在服务器环境变量中设置 KUAIDI100_CUSTOMER 与 KUAIDI100_KEY）。",
      },
      { status: 503 }
    );
  } catch (error) {
    console.error("[public/tracking] error:", error);
    return NextResponse.json(
      { success: false, message: "服务器内部异常，请稍后重试" },
      { status: 500 }
    );
  }
}
