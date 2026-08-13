-- Multiusuario: cada fila de datos pasa a pertenecer a un usuario.
--
-- El backfill asigna todo lo existente al usuario más antiguo (hoy hay uno solo:
-- el owner). Si la tabla User estuviera vacía, el SET NOT NULL falla y la
-- migración aborta — que es el comportamiento correcto, no queremos datos huérfanos.

-- AlterTable User: los usuarios de Google no tienen contraseña
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "googleSub" TEXT;
ALTER TABLE "User" ADD COLUMN "picture" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");

-- AlterTable Transaction
ALTER TABLE "Transaction" ADD COLUMN "userId" TEXT;
UPDATE "Transaction" SET "userId" = (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1);
ALTER TABLE "Transaction" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable Card
ALTER TABLE "Card" ADD COLUMN "userId" TEXT;
UPDATE "Card" SET "userId" = (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1);
ALTER TABLE "Card" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable UnparsedEmail
ALTER TABLE "UnparsedEmail" ADD COLUMN "userId" TEXT;
UPDATE "UnparsedEmail" SET "userId" = (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1);
ALTER TABLE "UnparsedEmail" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable OAuthToken: deja de ser un singleton global
ALTER TABLE "OAuthToken" ADD COLUMN "userId" TEXT;
UPDATE "OAuthToken" SET "userId" = (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1);
ALTER TABLE "OAuthToken" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable GmailSync: idem
ALTER TABLE "GmailSync" ADD COLUMN "userId" TEXT;
UPDATE "GmailSync" SET "userId" = (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1);
ALTER TABLE "GmailSync" ALTER COLUMN "userId" SET NOT NULL;

-- DropIndex: los IDs de Gmail son únicos por buzón, no entre buzones
DROP INDEX "Transaction_gmailMessageId_key";
DROP INDEX "UnparsedEmail_gmailMessageId_key";

-- DropIndex: dos usuarios pueden tener una tarjeta con los mismos últimos 4
DROP INDEX "Card_last4_kind_key";

-- DropIndex: reemplazados por índices compuestos con userId
DROP INDEX "Transaction_transactionDate_idx";
DROP INDEX "UnparsedEmail_resolvedAt_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Card_userId_last4_kind_key" ON "Card"("userId", "last4", "kind");
CREATE INDEX "Card_userId_idx" ON "Card"("userId");
CREATE UNIQUE INDEX "Transaction_userId_gmailMessageId_key" ON "Transaction"("userId", "gmailMessageId");
CREATE INDEX "Transaction_userId_transactionDate_idx" ON "Transaction"("userId", "transactionDate");
CREATE UNIQUE INDEX "UnparsedEmail_userId_gmailMessageId_key" ON "UnparsedEmail"("userId", "gmailMessageId");
CREATE INDEX "UnparsedEmail_userId_resolvedAt_idx" ON "UnparsedEmail"("userId", "resolvedAt");
CREATE UNIQUE INDEX "OAuthToken_userId_key" ON "OAuthToken"("userId");
CREATE UNIQUE INDEX "GmailSync_userId_key" ON "GmailSync"("userId");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UnparsedEmail" ADD CONSTRAINT "UnparsedEmail_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OAuthToken" ADD CONSTRAINT "OAuthToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmailSync" ADD CONSTRAINT "GmailSync_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
