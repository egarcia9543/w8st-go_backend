-- Fase 2: separar `paymentMethod` en tres ejes (direction / fundingSource / card),
-- añadir el catálogo de instrumentos y la bandeja de correos no parseados.
--
-- NOTA: los renombres usan RENAME COLUMN, no DROP + ADD, para conservar los datos
-- que ya están en la tabla. No corras esto como drop/create.

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('OUTFLOW', 'INFLOW');

-- CreateEnum
CREATE TYPE "FundingSource" AS ENUM ('OWN_FUNDS', 'CREDIT', 'INTERNAL');

-- CreateEnum
CREATE TYPE "CardKind" AS ENUM ('CREDIT', 'DEBIT', 'ACCOUNT');

-- RenameColumn: los nombres viejos mienten apenas entran los ingresos
-- (en una transferencia recibida, `recipientName` guarda al REMITENTE).
ALTER TABLE "Transaction" RENAME COLUMN "recipientName" TO "counterpartyName";
ALTER TABLE "Transaction" RENAME COLUMN "recipientKey" TO "counterpartyKey";
ALTER TABLE "Transaction" RENAME COLUMN "cardLast4" TO "instrumentLast4";

-- AlterTable
ALTER TABLE "Transaction"
    ADD COLUMN "direction" "Direction" NOT NULL DEFAULT 'OUTFLOW',
    ADD COLUMN "fundingSource" "FundingSource" NOT NULL DEFAULT 'OWN_FUNDS',
    ADD COLUMN "cardId" TEXT,
    ADD COLUMN "excludeFromSpending" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "manualOverride" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "ruleName" TEXT;

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "kind" "CardKind" NOT NULL,
    "alias" TEXT,
    "issuer" TEXT DEFAULT 'Bancolombia',
    "cutoffDay" INTEGER,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnparsedEmail" (
    "id" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "snippet" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnparsedEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Card_last4_kind_key" ON "Card"("last4", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "UnparsedEmail_gmailMessageId_key" ON "UnparsedEmail"("gmailMessageId");

-- CreateIndex
CREATE INDEX "UnparsedEmail_resolvedAt_idx" ON "UnparsedEmail"("resolvedAt");

-- CreateIndex
CREATE INDEX "Transaction_transactionDate_idx" ON "Transaction"("transactionDate");

-- CreateIndex
CREATE INDEX "Transaction_cardId_idx" ON "Transaction"("cardId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_cardId_fkey"
    FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;
