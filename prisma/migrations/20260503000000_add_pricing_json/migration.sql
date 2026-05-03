-- PricingSetting: 增加 pricingJson 字段，存储头程报价单完整内容（JSON 字符串）
ALTER TABLE "PricingSetting" ADD COLUMN "pricingJson" TEXT;
