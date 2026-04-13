-- TransportBill: isForecastPending 默认值改为 true；补全 updatedAt 列（与 schema 一致）。
-- domesticTracking / goodsName / estimatedPieces 在既有迁移中已存在，此处一并校验表结构。

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TransportBill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackingNumber" TEXT NOT NULL,
    "warehouse" TEXT NOT NULL,
    "shippingMethod" TEXT NOT NULL,
    "actualCBM" REAL NOT NULL,
    "actualWeight" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "isMinChargeWaived" BOOLEAN NOT NULL DEFAULT false,
    "isForecastPending" BOOLEAN NOT NULL DEFAULT true,
    "domesticTracking" TEXT,
    "goodsName" TEXT,
    "estimatedPieces" INTEGER NOT NULL DEFAULT 0,
    "clientUserId" TEXT,
    "destinationCountry" TEXT NOT NULL DEFAULT '泰国',
    "departureDate" DATETIME,
    "preOrderStatus" TEXT NOT NULL DEFAULT 'PRE_ALERT',
    "remark" TEXT,
    "mark" TEXT,
    "totalPackages" INTEGER NOT NULL DEFAULT 0,
    "declaredTotalWeight" REAL NOT NULL DEFAULT 0,
    "declaredTotalVolume" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TransportBill_clientUserId_fkey" FOREIGN KEY ("clientUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TransportBill" ("actualCBM", "actualWeight", "clientUserId", "createdAt", "declaredTotalVolume", "declaredTotalWeight", "departureDate", "destinationCountry", "domesticTracking", "estimatedPieces", "goodsName", "id", "isForecastPending", "isMinChargeWaived", "mark", "preOrderStatus", "remark", "shippingMethod", "totalPackages", "trackingNumber", "unitPrice", "warehouse", "updatedAt") SELECT "actualCBM", "actualWeight", "clientUserId", "createdAt", "declaredTotalVolume", "declaredTotalWeight", "departureDate", "destinationCountry", "domesticTracking", "estimatedPieces", "goodsName", "id", "isForecastPending", "isMinChargeWaived", "mark", "preOrderStatus", "remark", "shippingMethod", "totalPackages", "trackingNumber", "unitPrice", "warehouse", "createdAt" FROM "TransportBill";
DROP TABLE "TransportBill";
ALTER TABLE "new_TransportBill" RENAME TO "TransportBill";
CREATE UNIQUE INDEX "TransportBill_trackingNumber_key" ON "TransportBill"("trackingNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
