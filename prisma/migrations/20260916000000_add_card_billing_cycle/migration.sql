-- AlterTable
ALTER TABLE "Card"
    ADD COLUMN "paymentGraceDays" INTEGER,
    ADD COLUMN "creditLimit" DOUBLE PRECISION;
