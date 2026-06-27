-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StoreConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "storeName" TEXT NOT NULL,
    "whatsappNumber" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "preparationTime" TEXT NOT NULL,
    "announcement" TEXT,
    "deliveryFee" INTEGER NOT NULL DEFAULT 0,
    "pixKey" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_StoreConfig" ("address", "announcement", "city", "createdAt", "deliveryFee", "id", "isOpen", "preparationTime", "state", "storeName", "updatedAt", "whatsappNumber") SELECT "address", "announcement", "city", "createdAt", "deliveryFee", "id", "isOpen", "preparationTime", "state", "storeName", "updatedAt", "whatsappNumber" FROM "StoreConfig";
DROP TABLE "StoreConfig";
ALTER TABLE "new_StoreConfig" RENAME TO "StoreConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
