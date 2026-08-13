import { Router, Request, Response } from "express";
import prisma from "../../../infrastructure/database/prisma";
import { requireAuth } from "../middlewares/auth.middleware";
import { currentUserId } from "../current-user";
import { esMesValido, finDeMes, inicioDeMes, mesBogota } from "../../../infrastructure/date/bogota";

export const transactionRouter = Router();

transactionRouter.use(requireAuth);

const DIRECCIONES = ["OUTFLOW", "INFLOW"] as const;
const FUENTES = ["OWN_FUNDS", "CREDIT", "INTERNAL"] as const;

type Direccion = (typeof DIRECCIONES)[number];
type Fuente = (typeof FUENTES)[number];

const esDireccion = (v: string): v is Direccion => DIRECCIONES.includes(v as Direccion);
const esFuente = (v: string): v is Fuente => FUENTES.includes(v as Fuente);

transactionRouter.get("/transactions", async (req: Request, res: Response) => {
  const { month, direction, fundingSource, cardId, type } = req.query as {
    month?: string;
    direction?: string;
    fundingSource?: string;
    cardId?: string;
    type?: string;
  };

  if (month && !esMesValido(month)) {
    return res.status(400).json({ error: "`month` debe ser YYYY-MM." });
  }
  if (direction && !esDireccion(direction)) {
    return res.status(400).json({ error: `\`direction\` debe ser uno de: ${DIRECCIONES.join(", ")}.` });
  }
  if (fundingSource && !esFuente(fundingSource)) {
    return res.status(400).json({ error: `\`fundingSource\` debe ser uno de: ${FUENTES.join(", ")}.` });
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      userId: currentUserId(req),
      ...(month
        ? { transactionDate: { gte: inicioDeMes(month), lt: finDeMes(month) } }
        : {}),
      ...(direction && esDireccion(direction) ? { direction } : {}),
      ...(fundingSource && esFuente(fundingSource) ? { fundingSource } : {}),
      ...(cardId ? { cardId } : {}),
      ...(type ? { type } : {}),
    },
    orderBy: { transactionDate: "desc" },
    include: {
      card: { select: { id: true, last4: true, kind: true, alias: true } },
    },
  });

  // Los dos últimos campos son alias de compatibilidad: el front todavía lee
  // `recipientName` y `cardLast4` (mapper de la Fase 3 sin migrar). Sin esto la
  // tabla de transacciones se queda sin columna de destinatario.
  // ELIMINAR cuando el front migre a counterpartyName / instrumentLast4.
  res.json(
    transactions.map((tx) => ({
      ...tx,
      recipientName: tx.counterpartyName,
      recipientKey: tx.counterpartyKey,
      cardLast4: tx.instrumentLast4,
    }))
  );
});

// El override manual de §3.3: la única defensa contra un pago de tarjeta que
// llegue con la plantilla genérica de "Pagaste" y sea indistinguible de un gasto.
transactionRouter.patch("/transactions/:id", async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { fundingSource, excludeFromSpending, cardId, direction } = (req.body ?? {}) as {
    fundingSource?: string;
    excludeFromSpending?: boolean;
    cardId?: string | null;
    direction?: string;
  };

  if (fundingSource !== undefined && !esFuente(fundingSource)) {
    return res.status(400).json({ error: `\`fundingSource\` debe ser uno de: ${FUENTES.join(", ")}.` });
  }
  if (direction !== undefined && !esDireccion(direction)) {
    return res.status(400).json({ error: `\`direction\` debe ser uno de: ${DIRECCIONES.join(", ")}.` });
  }

  const existe = await prisma.transaction.findFirst({
    where: { id, userId: currentUserId(req) },
    select: { id: true },
  });
  if (!existe) return res.status(404).json({ error: "Transacción no encontrada." });

  if (cardId) {
    const card = await prisma.card.findFirst({
      where: { id: cardId, userId: currentUserId(req) },
      select: { id: true },
    });
    if (!card) return res.status(400).json({ error: "`cardId` no corresponde a ninguna tarjeta." });
  }

  const transaction = await prisma.transaction.update({
    where: { id },
    data: {
      ...(fundingSource !== undefined && esFuente(fundingSource) ? { fundingSource } : {}),
      ...(direction !== undefined && esDireccion(direction) ? { direction } : {}),
      ...(excludeFromSpending !== undefined ? { excludeFromSpending } : {}),
      ...(cardId !== undefined ? { cardId } : {}),
      // Marca la fila como tocada a mano para que un re-sync no la pise.
      manualOverride: true,
    },
    include: { card: { select: { id: true, last4: true, kind: true, alias: true } } },
  });

  res.json(transaction);
});

/**
 * @deprecated Lo reemplaza GET /analytics/summary, que separa bolsillo, crédito
 * e ingresos. Se mantiene un release para no romper el front antes de la Fase 3.
 *
 * Ojo: ahora que existen los ingresos hay que excluirlos explícitamente. Sin
 * eso, una nómina de $2M entraría a este total como si fuera gasto.
 */
transactionRouter.get("/transactions/summary", async (req: Request, res: Response) => {
  const transactions = await prisma.transaction.findMany({
    where: { userId: currentUserId(req), direction: "OUTFLOW", excludeFromSpending: false },
    select: { transactionDate: true, amount: true },
    orderBy: { transactionDate: "asc" },
  });

  const byMonth: Record<string, { total: number; count: number }> = {};

  for (const tx of transactions) {
    const key = mesBogota(tx.transactionDate);
    if (!byMonth[key]) byMonth[key] = { total: 0, count: 0 };
    byMonth[key].total += tx.amount;
    byMonth[key].count += 1;
  }

  res.json(
    Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        total: Math.round(data.total),
        count: data.count,
      }))
  );
});
