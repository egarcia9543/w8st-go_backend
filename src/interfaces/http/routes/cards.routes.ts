import { Router, Request, Response } from "express";
import prisma from "../../../infrastructure/database/prisma";
import { requireAuth } from "../middlewares/auth.middleware";

export const cardsRouter = Router();

cardsRouter.use(requireAuth);

cardsRouter.get("/cards", async (_req: Request, res: Response) => {
  const cards = await prisma.card.findMany({
    orderBy: [{ kind: "asc" }, { last4: "asc" }],
    include: { _count: { select: { transactions: true } } },
  });

  res.json(
    cards.map((c) => ({
      id: c.id,
      last4: c.last4,
      kind: c.kind,
      alias: c.alias,
      issuer: c.issuer,
      cutoffDay: c.cutoffDay,
      archived: c.archived,
      transactionCount: c._count.transactions,
    }))
  );
});

// Sin esto las tarjetas se llaman "*1234" para siempre y la vista por tarjeta
// no comunica nada.
cardsRouter.patch("/cards/:id", async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { alias, cutoffDay, archived, issuer } = (req.body ?? {}) as {
    alias?: string | null;
    cutoffDay?: number | null;
    archived?: boolean;
    issuer?: string | null;
  };

  if (cutoffDay !== undefined && cutoffDay !== null) {
    if (!Number.isInteger(cutoffDay) || cutoffDay < 1 || cutoffDay > 31) {
      return res.status(400).json({ error: "`cutoffDay` debe ser un entero entre 1 y 31." });
    }
  }

  const existe = await prisma.card.findUnique({ where: { id }, select: { id: true } });
  if (!existe) return res.status(404).json({ error: "Tarjeta no encontrada." });

  const card = await prisma.card.update({
    where: { id },
    data: {
      ...(alias !== undefined ? { alias } : {}),
      ...(cutoffDay !== undefined ? { cutoffDay } : {}),
      ...(archived !== undefined ? { archived } : {}),
      ...(issuer !== undefined ? { issuer } : {}),
    },
  });

  res.json(card);
});
