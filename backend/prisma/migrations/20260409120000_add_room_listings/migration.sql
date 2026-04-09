CREATE TABLE "RoomListing" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "address" TEXT,
    "priceText" TEXT,
    "contact" TEXT,
    "link" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomListing_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RoomListing_city_idx" ON "RoomListing"("city");
CREATE INDEX "RoomListing_active_idx" ON "RoomListing"("active");
CREATE INDEX "RoomListing_createdAt_idx" ON "RoomListing"("createdAt");
