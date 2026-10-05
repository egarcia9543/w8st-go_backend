-- CreateTable
CREATE TABLE "ReferenceIncome" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferenceIncome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferenceIncome_userId_effectiveFrom_key" ON "ReferenceIncome"("userId", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "ReferenceIncome" ADD CONSTRAINT "ReferenceIncome_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
