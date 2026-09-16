import { Router, Request, Response } from "express";
import prisma from "../../../infrastructure/database/prisma";
import { requireAuth } from "../middlewares/auth.middleware";
import { currentUserId } from "../current-user";
import { esMesValido, finDeMes, inicioDeMes, mesBogota } from "../../../infrastructure/date/bogota";
import {
  BillingCycle,
  cicloPorMes,
  cicloSerializado,
  cicloVigente,
  usaCicloDeFacturacion,
} from "../../../infrastructure/date/billing-cycle";

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
      userId: currentUserId(req),
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

const MONEDA_PRINCIPAL = "COP";

type Periodo = {
  basis: "cycle" | "calendar";
  label: string;
  from: string;
  to: string;
  closesOn: string | null;
  paymentDueDate: string | null;
};

type Ventana = { from: Date | null; to: Date | null; period: Periodo | null };

const ventanaDeCiclo = (ciclo: BillingCycle): Ventana => ({
  from: ciclo.from,
  to: ciclo.to,
  period: { basis: "cycle", ...cicloSerializado(ciclo) },
});

const ventanaCalendario = (month: string): Ventana => {
  const from = inicioDeMes(month);
  const to = finDeMes(month);

  return {
    from,
    to,
    period: {
      basis: "calendar",
      label: month,
      from: from.toISOString(),
      to: to.toISOString(),
      closesOn: null,
      paymentDueDate: null,
    },
  };
};

const ventanaDeTarjeta = (
  card: { kind: string; cutoffDay: number | null; paymentGraceDays: number | null },
  month: string | undefined,
  vigente: boolean
): Ventana => {
  if (vigente) {
    return usaCicloDeFacturacion(card.kind, card.cutoffDay)
      ? ventanaDeCiclo(cicloVigente(new Date(), card.cutoffDay, card.paymentGraceDays))
      : ventanaCalendario(mesBogota(new Date()));
  }

  if (!month) return { from: null, to: null, period: null };

  return usaCicloDeFacturacion(card.kind, card.cutoffDay)
    ? ventanaDeCiclo(cicloPorMes(month, card.cutoffDay, card.paymentGraceDays))
    : ventanaCalendario(month);
};

analyticsRouter.get("/analytics/by-card", async (req: Request, res: Response) => {
  const { month, period } = req.query as { month?: string; period?: string };

  if (month && !esMesValido(month)) {
    return res.status(400).json({ error: "`month` debe ser YYYY-MM." });
  }
  if (period !== undefined && period !== "current") {
    return res.status(400).json({ error: "`period` sólo acepta el valor `current`." });
  }

  const vigente = period === "current";
  const userId = currentUserId(req);

  const cards = await prisma.card.findMany({
    where: { userId, archived: false },
    select: {
      id: true,
      last4: true,
      kind: true,
      alias: true,
      cutoffDay: true,
      paymentGraceDays: true,
      creditLimit: true,
    },
  });

  if (cards.length === 0) return res.json([]);

  const ventanas = new Map(
    cards.map((card) => [card.id, ventanaDeTarjeta(card, month, vigente)])
  );

  const limites = [...ventanas.values()].filter((v) => v.from && v.to);
  const desde = limites.length
    ? new Date(Math.min(...limites.map((v) => v.from!.getTime())))
    : null;
  const hasta = limites.length
    ? new Date(Math.max(...limites.map((v) => v.to!.getTime())))
    : null;

  const transacciones = await prisma.transaction.findMany({
    where: {
      userId,
      direction: "OUTFLOW",
      excludeFromSpending: false,
      cardId: { in: cards.map((c) => c.id) },
      ...(desde && hasta ? { transactionDate: { gte: desde, lt: hasta } } : {}),
    },
    select: {
      amount: true,
      currency: true,
      merchant: true,
      counterpartyName: true,
      transactionDate: true,
      cardId: true,
    },
  });

  type Acumulado = {
    cardId: string;
    currency: string;
    total: number;
    count: number;
    comercios: Map<string, number>;
  };

  const porTarjeta = new Map<string, Acumulado>();

  const acumular = (cardId: string, currency: string): Acumulado => {
    const clave = `${cardId}|${currency}`;
    const existente = porTarjeta.get(clave);
    if (existente) return existente;

    const nuevo: Acumulado = { cardId, currency, total: 0, count: 0, comercios: new Map() };
    porTarjeta.set(clave, nuevo);
    return nuevo;
  };

  for (const tx of transacciones) {
    if (!tx.cardId) continue;

    const ventana = ventanas.get(tx.cardId);
    if (!ventana) continue;
    if (ventana.from && tx.transactionDate < ventana.from) continue;
    if (ventana.to && tx.transactionDate >= ventana.to) continue;

    const acc = acumular(tx.cardId, tx.currency);
    acc.total += tx.amount;
    acc.count += 1;

    const nombre = tx.merchant ?? tx.counterpartyName;
    if (nombre) acc.comercios.set(nombre, (acc.comercios.get(nombre) ?? 0) + tx.amount);
  }

  for (const card of cards) {
    if (!ventanas.get(card.id)?.period) continue;
    if (!usaCicloDeFacturacion(card.kind, card.cutoffDay)) continue;
    acumular(card.id, MONEDA_PRINCIPAL);
  }

  const porId = new Map(cards.map((card) => [card.id, card]));
  const redondear = (n: number) => Math.round(n * 100) / 100;

  const filas = [...porTarjeta.values()]
    .map((a) => {
      const card = porId.get(a.cardId)!;
      const total = redondear(a.total);

      return {
        cardId: a.cardId,
        last4: card.last4,
        kind: card.kind,
        alias: card.alias,
        cutoffDay: card.cutoffDay,
        paymentGraceDays: card.paymentGraceDays,
        creditLimit: card.creditLimit,
        currency: a.currency,
        total,
        count: a.count,
        utilization:
          card.creditLimit && card.creditLimit > 0 && a.currency === MONEDA_PRINCIPAL
            ? Math.round((total / card.creditLimit) * 10000) / 10000
            : null,
        period: ventanas.get(a.cardId)!.period,
        topMerchants: [...a.comercios.entries()]
          .sort((x, y) => y[1] - x[1])
          .slice(0, 5)
          .map(([merchant, total]) => ({ merchant, total: redondear(total) })),
      };
    })
    .sort((a, b) => b.total - a.total);

  res.json(filas);
});
