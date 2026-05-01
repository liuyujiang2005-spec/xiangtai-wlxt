import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q) {
    return NextResponse.json(
      { message: "请输入要查询的品牌或商标名称" },
      { status: 400 }
    );
  }

  const keyword = q.trim().toLowerCase();

  // 模拟网络延迟
  await new Promise((resolve) => setTimeout(resolve, 800));

  // 模拟常见的侵权黑名单
  const blacklist = ["apple", "nike", "adidas", "gucci", "disney", "lego", "louis vuitton", "chanel"];
  
  if (blacklist.some(b => keyword.includes(b))) {
    return NextResponse.json({
      success: true,
      data: {
        isRegistered: true,
        riskLevel: "HIGH",
        records: [
          {
            recordNo: `T${Math.floor(Math.random() * 100000000)}`,
            brand: keyword.toUpperCase(),
            category: "服装、鞋帽、电子产品等",
            owner: "XX国际控股有限公司",
            validUntil: "2030-12-31",
            status: "有效备案",
            warning: "该品牌已在海关进行知识产权备案，未经授权出口极易被扣关，属于高风险敏感货物。"
          }
        ]
      }
    });
  }

  // 随机生成一些普通备案或无备案
  const isRandomRegistered = Math.random() > 0.6;
  if (isRandomRegistered) {
    return NextResponse.json({
      success: true,
      data: {
        isRegistered: true,
        riskLevel: "MEDIUM",
        records: [
          {
            recordNo: `P${Math.floor(Math.random() * 100000000)}`,
            brand: keyword.toUpperCase(),
            category: "日用品",
            owner: "某某贸易有限公司",
            validUntil: "2028-05-20",
            status: "有效备案",
            warning: "存在海关备案，出口请确认是否已取得品牌方授权书。"
          }
        ]
      }
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      isRegistered: false,
      riskLevel: "LOW",
      records: [],
      warning: "未查询到相关的海关知识产权备案信息，但仍需注意目标国家当地的商标注册情况。"
    }
  });
}