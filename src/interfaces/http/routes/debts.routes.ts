import { Router, Request, Response } from "express";
import prisma from "../../../infrastructure/database/prisma";
import { requireAuth } from "../middlewares/auth.middleware";
import { currentUserId } from "../current-user";
import { mesBogota } from "../../../infrastructure/date/bogota";
import { buildDebtPlan } from "../../../application/use-cases/debt-plan";
import { parseDebtInput, parseExtra, parsePaymentInput } from "../debt-input";

export const debtsRouter = Router();

debtsRouter.use(requireAuth);

type DebtRow = {
  id: string;
  name: string;
  kind: string;
  balance: number;
  annualRate: number;
  monthlyPayment: number;
  paidByOther: boolean;
  notes: string | null;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const serializeDebt = (debt: DebtRow) => ({
  id: debt.id,
  name: debt.name,
  kind: debt.kind,
  balance: debt.balance,
  annualRate: debt.annualRate,
  monthlyPayment: debt.monthlyPayment,
  paidByOther: debt.paidByOther,
  notes: debt.notes,
  archived: debt.archived,
  createdAt: debt.createdAt,
  updatedAt: debt.updatedAt,
});

const findOwnDebt = (userId: string, id: string) =>
  prisma.debt.findFirst({ where: { id, userId } });

debtsRouter.get("/debts", async (req: Request, res: Response) => {
  const { includeArchived } = req.query as { includeArchived?: string };

  const debts = await prisma.debt.findMany({
    where: {
      userId: currentUserId(req),
      ...(includeArchived === "true" ? {} : { archived: false }),
    },
    orderBy: [{ annualRate: "desc" }, { balance: "asc" }],
  });

  res.json(debts.map(serializeDebt));
});

// Va antes de /debts/:id para que "plan" no se lea como un id.
debtsRouter.get("/debts/plan", async (req: Request, res: Response) => {
  const extra = parseExtra((req.query as { extra?: string }).extra);
  if (!extra.ok) return res.status(400).json({ error: extra.error });

  const debts = await prisma.debt.findMany({
    where: { userId: currentUserId(req), archived: false, balance: { gt: 0 } },
    select: {
      id: true,
      name: true,
      balance: true,
      annualRate: true,
      monthlyPayment: true,
      paidByOther: true,
    },
  });

  res.json(buildDebtPlan({ debts, extraPerMonth: extra.value, startMonth: mesBogota(new Date()) }));
});

debtsRouter.post("/debts", async (req: Request, res: Response) => {
  const parsed = parseDebtInput(req.body, "create");
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });

  const { name, balance, annualRate, monthlyPayment, ...rest } = parsed.value;
  const debt = await prisma.debt.create({
    data: {
      userId: currentUserId(req),
      // El parser ya garantiza estos campos en modo "create".
      name: name!,
      balance: balance!,
      annualRate: annualRate!,
      monthlyPayment: monthlyPayment!,
      ...rest,
    },
  });

  res.status(201).json(serializeDebt(debt));
});

debtsRouter.patch("/debts/:id", async (req: Request, res: Response) => {
  const parsed = parseDebtInput(req.body, "update");
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });

  const userId = currentUserId(req);
  const existing = await findOwnDebt(userId, String(req.params.id));
  if (!existing) return res.status(404).json({ error: "Deuda no encontrada." });

  const debt = await prisma.debt.update({ where: { id: existing.id }, data: parsed.value });
  res.json(serializeDebt(debt));
});

debtsRouter.delete("/debts/:id", async (req: Request, res: Response) => {
  const { count } = await prisma.debt.deleteMany({
    where: { id: String(req.params.id), userId: currentUserId(req) },
  });
  if (count === 0) return res.status(404).json({ error: "Deuda no encontrada." });

  res.status(204).end();
});

// Registra un pago (cuota o abono extra) y lo descuenta del saldo. Sirve también
// para los pagos a tarjetas hechos dentro de Bancolombia, que no llegan por correo.
debtsRouter.post("/debts/:id/payments", async (req: Request, res: Response) => {
  const parsed = parsePaymentInput(req.body, new Date());
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });

  const userId = currentUserId(req);
  const existing = await findOwnDebt(userId, String(req.params.id));
  if (!existing) return res.status(404).json({ error: "Deuda no encontrada." });

  const { amount, paidAt } = parsed.value;
  const [, debt] = await prisma.$transaction([
    prisma.debtPayment.create({ data: { userId, debtId: existing.id, amount, paidAt } }),
    prisma.debt.update({
      where: { id: existing.id },
      data: { balance: Math.max(existing.balance - amount, 0) },
    }),
  ]);

  res.status(201).json(serializeDebt(debt));
});

debtsRouter.get("/debts/:id/payments", async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const existing = await findOwnDebt(userId, String(req.params.id));
  if (!existing) return res.status(404).json({ error: "Deuda no encontrada." });

  const payments = await prisma.debtPayment.findMany({
    where: { debtId: existing.id },
    orderBy: { paidAt: "desc" },
    select: { id: true, amount: true, paidAt: true },
  });

  res.json(payments);
});
