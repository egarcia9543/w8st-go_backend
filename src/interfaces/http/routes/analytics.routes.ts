import { Router, Request, Response } from "express";
import prisma from "../../../infrastructure/database/prisma";
import { requireAuth } from "../middlewares/auth.middleware";
import { esMesValido, finDeMes, inicioDeMes, mesBogota } from "../../../infrastructure/date/bogota";

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth);

type Bucket = {
  month: string;
  currency: string;
  outOfPocket: number;
  credit: number;
  income: number;
  internal: number;
  counts: { outOfPocket: number; credit: number; income: number; internal: number };
};

const bucketVacio = (month: string, currency: string): Bucket => ({
  month,
  currency,
  outOfPocket: 0,
  credit: 0,
  income: 0,
  internal: 0,
  counts: { outOfPocket: 0, credit: 0, income: 0, internal: 0 },
});

// COP y USD no se suman: son magnitudes distintas. Se devuelve una fila por
// (mes, moneda) y el front decide cómo presentarlas.
analyticsRouter.get("/analytics/summary", async (req: Request, res: Response) => {
  const { from, to } = req.query as { from?: string; to?: string };

  if (from && !esMesValido(from)) return res.status(400).json({ error: "`from` debe ser YYYY-MM." });
  if (to && !esMesValido(to)) return res.status(400).json({ error: "`to` debe ser YYYY-MM." });

  const transacciones = await prisma.transaction.findMany({
    where: {
      transactionDate: {
        ...(from ? { gte: inicioDeMes(from) } : {}),
        ...(to ? { lt: finDeMes(to) } : {}),
      },
    },
    select: {
      transactionDate: true,
      amount: true,
      currency: true,
      direction: true,
      fundingSource: true,
      excludeFromSpending: true,
    },
  });

  const buckets = new Map<string, Bucket>();

  for (const tx of transacciones) {
    const month = mesBogota(tx.transactionDate);
    const clave = `${month}|${tx.currency}`;

    const bucket = buckets.get(clave) ?? bucketVacio(month, tx.currency);

    if (tx.fundingSource === "INTERNAL" || tx.excludeFromSpending) {
      // Traslados entre bolsillos propios: ni gasto ni ingreso. Se reportan
      // aparte para que el número exista, pero no entran en `net`.
      bucket.internal += tx.amount;
      bucket.counts.internal += 1;
    } else if (tx.direction === "INFLOW") {
      bucket.income += tx.amount;
      bucket.counts.income += 1;
    } else if (tx.fundingSource === "CREDIT") {
      bucket.credit += tx.amount;
      bucket.counts.credit += 1;
    } else {
      bucket.outOfPocket += tx.amount;
      bucket.counts.outOfPocket += 1;
    }

    buckets.set(clave, bucket);
  }

  const redondear = (n: number) => Math.round(n * 100) / 100;

  const filas = [...buckets.values()]
    .sort((a, b) => a.month.localeCompare(b.month) || a.currency.localeCompare(b.currency))
    .map((b) => ({
      month: b.month,
      currency: b.currency,
      outOfPocket: redondear(b.outOfPocket),
      credit: redondear(b.credit),
      income: redondear(b.income),
      internal: redondear(b.internal),
      net: redondear(b.income - b.outOfPocket - b.credit),
      counts: b.counts,
    }));

  res.json(filas);
});

// Gasto por instrumento, en mes calendario (decisión §4 del plan).
analyticsRouter.get("/analytics/by-card", async (req: Request, res: Response) => {
  const { month } = req.query as { month?: string };

  if (month && !esMesValido(month)) {
    return res.status(400).json({ error: "`month` debe ser YYYY-MM." });
  }

  const transacciones = await prisma.transaction.findMany({
    where: {
      direction: "OUTFLOW",
      excludeFromSpending: false,
      cardId: { not: null },
      ...(month
        ? { transactionDate: { gte: inicioDeMes(month), lt: finDeMes(month) } }
        : {}),
    },
    select: {
      amount: true,
      currency: true,
      merchant: true,
      counterpartyName: true,
      card: { select: { id: true, last4: true, kind: true, alias: true, cutoffDay: true } },
    },
  });

  type Acumulado = {
    cardId: string;
    last4: string;
    kind: string;
    alias: string | null;
    cutoffDay: number | null;
    currency: string;
    total: number;
    count: number;
    comercios: Map<string, number>;
  };

  const porTarjeta = new Map<string, Acumulado>();

  for (const tx of transacciones) {
    if (!tx.card) continue;
    const clave = `${tx.card.id}|${tx.currency}`;

    const acc: Acumulado = porTarjeta.get(clave) ?? {
      cardId: tx.card.id,
      last4: tx.card.last4,
      kind: tx.card.kind,
      alias: tx.card.alias,
      cutoffDay: tx.card.cutoffDay,
      currency: tx.currency,
      total: 0,
      count: 0,
      comercios: new Map(),
    };

    acc.total += tx.amount;
    acc.count += 1;

    const nombre = tx.merchant ?? tx.counterpartyName;
    if (nombre) acc.comercios.set(nombre, (acc.comercios.get(nombre) ?? 0) + tx.amount);

    porTarjeta.set(clave, acc);
  }

  const filas = [...porTarjeta.values()]
    .map((a) => ({
      cardId: a.cardId,
      last4: a.last4,
      kind: a.kind,
      alias: a.alias,
      cutoffDay: a.cutoffDay,
      currency: a.currency,
      total: Math.round(a.total * 100) / 100,
      count: a.count,
      period: month
        ? { from: inicioDeMes(month).toISOString(), to: finDeMes(month).toISOString() }
        : null,
      topMerchants: [...a.comercios.entries()]
        .sort((x, y) => y[1] - x[1])
        .slice(0, 5)
        .map(([merchant, total]) => ({ merchant, total: Math.round(total * 100) / 100 })),
    }))
    .sort((a, b) => b.total - a.total);

  res.json(filas);
});
