import { Router, Request, Response } from "express";
import prisma from "../../../infrastructure/database/prisma";
import { requireAuth } from "../middlewares/auth.middleware";
import { currentUserId } from "../current-user";
import {
  DIAS_GRACIA_MAX,
  DIAS_GRACIA_MIN,
  DIA_CORTE_MAX,
  DIA_CORTE_MIN,
  cicloSerializado,
  cicloVigente,
  esDiaDeCorteValido,
  esDiasDeGraciaValido,
  usaCicloDeFacturacion,
} from "../../../infrastructure/date/billing-cycle";

export const cardsRouter = Router();

cardsRouter.use(requireAuth);

type CardConConteo = {
  id: string;
  last4: string;
  kind: string;
  alias: string | null;
  issuer: string | null;
  cutoffDay: number | null;
  paymentGraceDays: number | null;
  creditLimit: number | null;
  archived: boolean;
  _count: { transactions: number };
};

const serializarCard = (card: CardConConteo, ahora: Date) => ({
  id: card.id,
  last4: card.last4,
  kind: card.kind,
  alias: card.alias,
  issuer: card.issuer,
  cutoffDay: card.cutoffDay,
  paymentGraceDays: card.paymentGraceDays,
  creditLimit: card.creditLimit,
  archived: card.archived,
  transactionCount: card._count.transactions,
  currentCycle: usaCicloDeFacturacion(card.kind, card.cutoffDay)
    ? cicloSerializado(cicloVigente(ahora, card.cutoffDay, card.paymentGraceDays))
    : null,
});

cardsRouter.get("/cards", async (req: Request, res: Response) => {
  const { includeArchived } = req.query as { includeArchived?: string };

  const cards = await prisma.card.findMany({
    where: {
      userId: currentUserId(req),
      ...(includeArchived === "true" ? {} : { archived: false }),
    },
    orderBy: [{ kind: "asc" }, { last4: "asc" }],
    include: { _count: { select: { transactions: true } } },
  });

  const ahora = new Date();

  res.json(cards.map((card) => serializarCard(card, ahora)));
});

// Sin esto las tarjetas se llaman "*1234" para siempre y la vista por tarjeta
// no comunica nada.
cardsRouter.patch("/cards/:id", async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { alias, cutoffDay, paymentGraceDays, creditLimit, archived, issuer } = (req.body ??
    {}) as {
    alias?: string | null;
    cutoffDay?: number | null;
    paymentGraceDays?: number | null;
    creditLimit?: number | null;
    archived?: boolean;
    issuer?: string | null;
  };

  if (cutoffDay !== undefined && cutoffDay !== null && !esDiaDeCorteValido(cutoffDay)) {
    return res.status(400).json({
      error: `\`cutoffDay\` debe ser un entero entre ${DIA_CORTE_MIN} y ${DIA_CORTE_MAX}.`,
    });
  }

  if (
    paymentGraceDays !== undefined &&
    paymentGraceDays !== null &&
    !esDiasDeGraciaValido(paymentGraceDays)
  ) {
    return res.status(400).json({
      error: `\`paymentGraceDays\` debe ser un entero entre ${DIAS_GRACIA_MIN} y ${DIAS_GRACIA_MAX}.`,
    });
  }

  if (creditLimit !== undefined && creditLimit !== null) {
    if (!Number.isFinite(creditLimit) || creditLimit < 0) {
      return res.status(400).json({ error: "`creditLimit` debe ser un número mayor o igual a 0." });
    }
  }

  const existe = await prisma.card.findFirst({
    where: { id, userId: currentUserId(req) },
    select: { id: true },
  });
  if (!existe) return res.status(404).json({ error: "Tarjeta no encontrada." });

  const card = await prisma.card.update({
    where: { id },
    data: {
      ...(alias !== undefined ? { alias } : {}),
      ...(cutoffDay !== undefined ? { cutoffDay } : {}),
      ...(paymentGraceDays !== undefined ? { paymentGraceDays } : {}),
      ...(creditLimit !== undefined ? { creditLimit } : {}),
      ...(archived !== undefined ? { archived } : {}),
      ...(issuer !== undefined ? { issuer } : {}),
    },
    include: { _count: { select: { transactions: true } } },
  });

  res.json(serializarCard(card, new Date()));
});
