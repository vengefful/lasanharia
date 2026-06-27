-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StoreConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "storeName" TEXT NOT NULL,
    "whatsappNumber" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "preparationTime" TEXT NOT NULL,
    "announcement" TEXT,
    "deliveryFee" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_StoreConfig" ("address", "announcement", "createdAt", "id", "isOpen", "preparationTime", "storeName", "updatedAt", "whatsappNumber") SELECT "address", "announcement", "createdAt", "id", "isOpen", "preparationTime", "storeName", "updatedAt", "whatsappNumber" FROM "StoreConfig";
DROP TABLE "StoreConfig";
ALTER TABLE "new_StoreConfig" RENAME TO "StoreConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
