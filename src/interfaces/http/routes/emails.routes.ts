import { Router, Request, Response } from "express";
import prisma from "../../../infrastructure/database/prisma";
import { requireAuth } from "../middlewares/auth.middleware";
import { reprocessUnparsed } from "../../../application/use-cases/reprocess-unparsed";

export const emailsRouter = Router();

emailsRouter.use(requireAuth);

// Vuelve a parsear los correos ya capturados. Se corre después de escribir una
// regla nueva: el sync normal no los traería de vuelta porque su ventana está
// anclada al último sync. No toca la API de Gmail.
emailsRouter.post("/emails/unparsed/reprocess", async (_req: Request, res: Response) => {
  const resultado = await reprocessUnparsed();
  res.json(resultado);
});

// La herramienta de diagnóstico permanente: cada vez que el banco cambie una
// plantilla, aparece aquí en vez de desaparecer en un console.warn.
emailsRouter.get("/emails/unparsed", async (req: Request, res: Response) => {
  const { reason, resolved } = req.query as { reason?: string; resolved?: string };

  const emails = await prisma.unparsedEmail.findMany({
    where: {
      ...(reason ? { reason } : {}),
      ...(resolved === "true"
        ? { resolvedAt: { not: null } }
        : resolved === "false"
          ? { resolvedAt: null }
          : {}),
    },
    orderBy: { receivedAt: "desc" },
    take: 200,
  });

  res.json(emails);
});

// Cuántos hay de cada tipo: sirve para saber si vale la pena escribir una regla
// nueva antes de leer 40 cuerpos.
emailsRouter.get("/emails/unparsed/stats", async (_req: Request, res: Response) => {
  const porRazon = await prisma.unparsedEmail.groupBy({
    by: ["reason"],
    _count: { _all: true },
    where: { resolvedAt: null },
  });

  res.json({
    pendientes: porRazon.map((r) => ({ reason: r.reason, count: r._count._all })),
  });
});

emailsRouter.patch("/emails/unparsed/:id", async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { resolved } = (req.body ?? {}) as { resolved?: boolean };

  const existe = await prisma.unparsedEmail.findUnique({ where: { id }, select: { id: true } });
  if (!existe) return res.status(404).json({ error: "Correo no encontrado." });

  const email = await prisma.unparsedEmail.update({
    where: { id },
    data: { resolvedAt: resolved === false ? null : new Date() },
  });

  res.json(email);
});
