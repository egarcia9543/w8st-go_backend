-- CreateEnum
CREATE TYPE "WishlistStatus" AS ENUM ('WANTED', 'BOUGHT', 'DISCARDED');

-- CreateTable
CREATE TABLE "WishlistTier" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "WishlistTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "productUrl" TEXT,
    "imageUrl" TEXT,
    "notes" TEXT,
    "position" INTEGER NOT NULL,
    "status" "WishlistStatus" NOT NULL DEFAULT 'WANTED',
    "boughtAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WishlistTier_userId_position_key" ON "WishlistTier"("userId", "position");

-- CreateIndex
CREATE INDEX "WishlistItem_userId_status_idx" ON "WishlistItem"("userId", "status");

-- CreateIndex
CREATE INDEX "WishlistItem_tierId_position_idx" ON "WishlistItem"("tierId", "position");

-- AddForeignKey
ALTER TABLE "WishlistTier" ADD CONSTRAINT "WishlistTier_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "WishlistTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
