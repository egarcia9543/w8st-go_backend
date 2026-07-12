import { Router, Request, Response } from "express";
import prisma from "../../../infrastructure/database/prisma";

export const transactionRouter = Router();

transactionRouter.get("/transactions", async (req: Request, res: Response) => {
  const { month } = req.query as { month?: string };

  const where = month
    ? {
        transactionDate: {
          gte: new Date(`${month}-01T00:00:00`),
          lt: new Date(
            new Date(`${month}-01T00:00:00`).setMonth(
              new Date(`${month}-01T00:00:00`).getMonth() + 1
            )
          ),
        },
      }
    : {};

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { transactionDate: "desc" },
  });

  res.json(transactions);
});

transactionRouter.get("/transactions/summary", async (_req: Request, res: Response) => {
  const transactions = await prisma.transaction.findMany({
    select: { transactionDate: true, amount: true, currency: true },
    orderBy: { transactionDate: "asc" },
  });

  const byMonth: Record<string, { total: number; count: number }> = {};

  for (const tx of transactions) {
    const key = tx.transactionDate.toISOString().slice(0, 7);
    if (!byMonth[key]) byMonth[key] = { total: 0, count: 0 };
    byMonth[key].total += tx.amount;
    byMonth[key].count += 1;
  }

  res.json(
    Object.entries(byMonth).map(([month, data]) => ({
      month,
      total: Math.round(data.total),
      count: data.count,
    }))
  );
});
