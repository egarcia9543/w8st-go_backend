import { Router, Request, Response } from "express";
import prisma from "../../../infrastructure/database/prisma";
import { requireAuth } from "../middlewares/auth.middleware";
import { currentUserId } from "../current-user";
import { esMesValido, finDeMes, inicioDeMes, mesBogota } from "../../../infrastructure/date/bogota";
import { ensureCategories } from "../../../application/use-cases/ensure-categories";
import { buildBudgetSummary } from "../../../application/use-cases/budget-summary";
import { isPositiveAmount } from "../budget-input";

export const budgetRouter = Router();

budgetRouter.use(requireAuth);

const INVALID_MONTH = "El mes debe tener el formato YYYY-MM.";

budgetRouter.get("/reference-income", async (req: Request, res: Response) => {
  const rows = await prisma.referenceIncome.findMany({
    where: { userId: currentUserId(req) },
    orderBy: { effectiveFrom: "desc" },
    select: { amount: true, effectiveFrom: true },
  });

  res.json(rows);
});

budgetRouter.put("/reference-income/:month", async (req: Request, res: Response) => {
  const effectiveFrom = String(req.params.month);
  const { amount } = (req.body ?? {}) as { amount?: unknown };

  if (!esMesValido(effectiveFrom)) return res.status(400).json({ error: INVALID_MONTH });
  if (!isPositiveAmount(amount)) {
    return res.status(400).json({ error: "`amount` debe ser un número mayor que 0." });
  }

  const userId = currentUserId(req);
  const row = await prisma.referenceIncome.upsert({
    where: { userId_effectiveFrom: { userId, effectiveFrom } },
    update: { amount },
    create: { userId, effectiveFrom, amount },
    select: { amount: true, effectiveFrom: true },
  });

  res.json(row);
});

budgetRouter.delete("/reference-income/:month", async (req: Request, res: Response) => {
  const effectiveFrom = String(req.params.month);
  if (!esMesValido(effectiveFrom)) return res.status(400).json({ error: INVALID_MONTH });

  const { count } = await prisma.referenceIncome.deleteMany({
    where: { userId: currentUserId(req), effectiveFrom },
  });
  if (count === 0) return res.status(404).json({ error: "No hay ingreso registrado desde ese mes." });

  res.status(204).end();
});

budgetRouter.get("/budget/summary", async (req: Request, res: Response) => {
  const now = new Date();
  const { month = mesBogota(now) } = req.query as { month?: string };

  if (!esMesValido(month)) return res.status(400).json({ error: INVALID_MONTH });

  const userId = currentUserId(req);
  await ensureCategories(userId);

  const [transactions, categories, groups, incomes] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, transactionDate: { gte: inicioDeMes(month), lt: finDeMes(month) } },
      select: {
        amount: true,
        currency: true,
        categoryId: true,
        direction: true,
        fundingSource: true,
        excludeFromSpending: true,
      },
    }),
    prisma.category.findMany({ where: { userId } }),
    prisma.budgetGroup.findMany({ where: { userId } }),
    prisma.referenceIncome.findMany({
      where: { userId, effectiveFrom: { lte: month } },
      select: { amount: true, effectiveFrom: true },
    }),
  ]);

  res.json(buildBudgetSummary({ month, now, transactions, categories, groups, incomes }));
});
