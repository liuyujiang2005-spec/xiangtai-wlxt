-- CreateTable
CREATE TABLE "TransportBill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackingNumber" TEXT NOT NULL,
    "warehouse" TEXT NOT NULL,
    "shippingMethod" TEXT NOT NULL,
    "actualCBM" REAL NOT NULL,
    "actualWeight" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "isMinChargeWaived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "TransportBill_trackingNumber_key" ON "TransportBill"("trackingNumber");
