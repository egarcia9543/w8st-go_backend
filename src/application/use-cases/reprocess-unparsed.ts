import { parseBody } from "../../infrastructure/gmail/parser.service";
import { resolverCard } from "./resolve-card";
import prisma from "../../infrastructure/database/prisma";

export type ReprocessResult = {
  reviewed: number;
  recovered: number;
  ignored: number;
  stillUnparsed: number;
};

/**
 * Vuelve a pasar el parser sobre los correos que quedaron sin interpretar.
 *
 * Existe porque el sync mira una ventana anclada al último sync: si escribes una
 * regla nueva hoy, un sync normal NO vuelve a traer los correos de hace tres
 * semanas que esa regla ahora sí entendería. Quedarían capturados pero muertos.
 *
 * Los cuerpos ya están guardados en UnparsedEmail, así que esto no toca la API
 * de Gmail: es solo CPU y escrituras.
 */
export const reprocessUnparsed = async (userId: string): Promise<ReprocessResult> => {
  const pendientes = await prisma.unparsedEmail.findMany({
    where: { userId, resolvedAt: null },
    orderBy: { receivedAt: "asc" },
  });

  const yaRegistrados = new Set(
    (
      await prisma.transaction.findMany({
        where: { userId, gmailMessageId: { in: pendientes.map((e) => e.gmailMessageId) } },
        select: { gmailMessageId: true },
      })
    ).map((t) => t.gmailMessageId)
  );

  let recovered = 0;
  let ignored = 0;
  let stillUnparsed = 0;

  for (const email of pendientes) {
    const resultado = parseBody(email.bodyText);

    if (!resultado.ok) {
      if (resultado.reason === "IGNORED") {
        await prisma.unparsedEmail.update({
          where: { id: email.id },
          data: { resolvedAt: new Date() },
        });
        ignored++;
      } else {
        stillUnparsed++;
      }
      continue;
    }

    if (!yaRegistrados.has(email.gmailMessageId)) {
      const { instrumentKind, ...datos } = resultado.transaction;
      const cardId = await resolverCard(userId, datos.instrumentLast4, instrumentKind);

      await prisma.transaction.create({
        data: { userId, gmailMessageId: email.gmailMessageId, ...datos, cardId },
      });
    }

    await prisma.unparsedEmail.update({
      where: { id: email.id },
      data: { resolvedAt: new Date() },
    });

    recovered++;
  }

  console.log(
    `[reprocess] ${pendientes.length} revisados: ${recovered} recuperados, ` +
      `${ignored} ignorados, ${stillUnparsed} siguen sin plantilla`
  );

  return { reviewed: pendientes.length, recovered, ignored, stillUnparsed };
};
