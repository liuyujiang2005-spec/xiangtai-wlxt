/**
 * 头程报价单数据结构与默认值（管理员可通过 /admin/pricing 页面全量编辑）。
 */

export type PricingRow = {
  name: string;
  desc: string;
  price: number;
};

export type PricingContent = {
  companyName: string;
  subtitle: string;
  headerNote: string;
  land: {
    transitDays: string;
    rows: PricingRow[];
    yiwuSurcharge: number;
  };
  sea: {
    transitDays: string;
    rows: PricingRow[];
  };
  billing: {
    landMinCbm: string;
    seaMinCbm: string;
  };
  terms: string[];
};

export const DEFAULT_PRICING: PricingContent = {
  companyName: "广州湘泰国际物流有限公司",
  subtitle: "联系人：湘泰 · 报价单主题：头程陆运 / 海运费用（中国 → 泰国曼谷）",
  headerNote:
    "以下价格单位为人民币（RMB），按体积为「元/方（CBM）」；具体以业务确认为准。",
  land: {
    transitDays: "5–7 天",
    rows: [
      { name: "陆运普货", desc: "不带电、不带磁、非品牌等", price: 1070 },
      {
        name: "陆运商检",
        desc: "带电、高货值、化妆品、木制品、机械、液体等需商检类",
        price: 1250,
      },
      {
        name: "陆运敏感货",
        desc: "锂电池、品牌、化工、粉末等敏感品",
        price: 1350,
      },
    ],
    yiwuSurcharge: 120,
  },
  sea: {
    transitDays: "12–15 天",
    rows: [
      {
        name: "海运普货",
        desc: "毛巾、胶袋、日用品等（无品牌、无液体/粉末等限制品）",
        price: 550,
      },
      {
        name: "海运商检",
        desc: "带电、高货值、化妆品、木材、机械、液体等",
        price: 700,
      },
      {
        name: "海运敏感货",
        desc: "化工、线香、食品添加剂、品牌货等",
        price: 800,
      },
    ],
  },
  billing: {
    landMinCbm: "0.3",
    seaMinCbm: "0.5",
  },
  terms: [
    "报价为人民币含税参考价，含泰国关税及曼谷市内派送；曼谷以外地区另计泰国国内物流费用。",
    "客户须如实提供品名、货值、重量、品牌等信息；因申报不实导致海关查扣等，责任由客户承担。",
    "陆运单件 100–500 KG 可能产生叉车费 200 元/票；单件超 500 KG 或单边超 120 CM 等需单独询价。",
    "遗失或损毁理赔：按出厂价核定，且不超过运费的 3 倍；高价值货物建议购买保险。",
    "易碎品破损一般不予理赔，请自行加强包装。",
    "询价时请提供：货物描述、重量、尺寸、品牌、图片及货值等资料。",
    "将货物交予本公司即视为接受上述条款。",
  ],
};
