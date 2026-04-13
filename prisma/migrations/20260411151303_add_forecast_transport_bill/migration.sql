-- RedefineTables
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
    "isForecastPending" BOOLEAN NOT NULL DEFAULT false,
    "domesticTracking" TEXT,
    "goodsName" TEXT,
    "estimatedPieces" INTEGER NOT NULL DEFAULT 0,
    "clientUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TransportBill_clientUserId_fkey" FOREIGN KEY ("clientUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TransportBill" ("actualCBM", "actualWeight", "createdAt", "id", "isMinChargeWaived", "shippingMethod", "trackingNumber", "unitPrice", "warehouse") SELECT "actualCBM", "actualWeight", "createdAt", "id", "isMinChargeWaived", "shippingMethod", "trackingNumber", "unitPrice", "warehouse" FROM "TransportBill";
DROP TABLE "TransportBill";
ALTER TABLE "new_TransportBill" RENAME TO "TransportBill";
CREATE UNIQUE INDEX "TransportBill_trackingNumber_key" ON "TransportBill"("trackingNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
