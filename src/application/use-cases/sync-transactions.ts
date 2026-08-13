import {
  fetchBancolombiaEmails,
  guardarHistoryId,
  FetchOptions,
} from "../../infrastructure/gmail/gmail.service";
import { parseEmail } from "../../infrastructure/gmail/parser.service";
import { diaBogota } from "../../infrastructure/date/bogota";
import { ventanaDesde } from "./sync-window";
import { resolverCard } from "./resolve-card";
import prisma from "../../infrastructure/database/prisma";

const calcularDesde = async (explicito?: string): Promise<string> => {
  if (explicito) return explicito;

  const ultimo = await prisma.gmailSync.findUnique({ where: { id: "singleton" } });
  const desde = ventanaDesde(new Date(), ultimo?.updatedAt ?? null);

  // Gmail espera YYYY/MM/DD en el operador `after:`.
  return diaBogota(desde).replace(/-/g, "/");
};

export type SyncResult = {
  created: number;
  duplicated: number;
  unparsed: number;
  /// Avisos del banco que no son movimientos de dinero. Ni error ni transacción.
  ignored: number;
  scanned: number;
  /// Desde qué fecha se miró el buzón en esta corrida (YYYY/MM/DD).
  since: string;
  /**
   * @deprecated Alias de compatibilidad = duplicated + unparsed.
   * El front todavía lee `skipped` y lo muestra como "omitidas", que es
   * justamente la confusión que estos contadores vienen a resolver: mezclaba
   * duplicados normales con fallos reales de parseo.
   * ELIMINAR cuando el front migre a los tres contadores.
   */
  skipped: number;
};

export const syncTransactions = async (options: FetchOptions = {}): Promise<SyncResult> => {
  const since = await calcularDesde(options.since);
  const emails = await fetchBancolombiaEmails({ ...options, since });

  // Un findUnique por correo era un viaje al pooler de Supabase por cada uno.
  // Con la ventana de 30 días son ~40, pero con un `since` amplio se vuelve el
  // cuello de botella real, por encima de la API de Gmail. Una sola consulta.
  const yaRegistrados = new Set(
    (
      await prisma.transaction.findMany({
        where: { gmailMessageId: { in: emails.map((e) => e.id) } },
        select: { gmailMessageId: true },
      })
    ).map((t) => t.gmailMessageId)
  );

  let created = 0;
  let duplicated = 0;
  let unparsed = 0;
  let ignored = 0;

  for (const email of emails) {
    if (yaRegistrados.has(email.id)) {
      duplicated++;
      continue;
    }

    const resultado = parseEmail(email.payload);

    // Avisos que no son movimientos de dinero (inscripción de facturas,
    // marketing). Se cuentan aparte y NO entran a la bandeja de diagnóstico:
    // mezclarlos con las plantillas que sí faltan la vuelve inservible.
    if (!resultado.ok && resultado.reason === "IGNORED") {
      await prisma.unparsedEmail.updateMany({
        where: { gmailMessageId: email.id, resolvedAt: null },
        data: { resolvedAt: new Date() },
      });
      ignored++;
      continue;
    }

    if (!resultado.ok) {
      // Antes esto era un console.warn y el cuerpo se perdía: no había forma de
      // saber qué plantilla faltaba sin volver a Gmail a mano.
      await prisma.unparsedEmail.upsert({
        where: { gmailMessageId: email.id },
        update: {
          reason: resultado.reason,
          bodyText: resultado.body.slice(0, 20000),
          subject: email.subject,
          fromAddress: email.fromAddress,
          snippet: email.snippet,
          receivedAt: email.receivedAt,
        },
        create: {
          gmailMessageId: email.id,
          reason: resultado.reason,
          bodyText: resultado.body.slice(0, 20000),
          subject: email.subject,
          fromAddress: email.fromAddress,
          snippet: email.snippet,
          receivedAt: email.receivedAt,
        },
      });

      unparsed++;
      continue;
    }

    const { instrumentKind, ...datos } = resultado.transaction;
    const cardId = await resolverCard(datos.instrumentLast4, instrumentKind);

    await prisma.transaction.create({
      data: {
        gmailMessageId: email.id,
        ...datos,
        cardId,
      },
    });

    // Si el correo ya se había registrado como no parseable y ahora sí se
    // entiende (regla nueva), se marca resuelto en vez de quedar como ruido.
    await prisma.unparsedEmail.updateMany({
      where: { gmailMessageId: email.id, resolvedAt: null },
      data: { resolvedAt: new Date() },
    });

    created++;
  }

  await guardarHistoryId();

  console.log(
    `[sync] desde ${since} — ${emails.length} revisados: ${created} nuevas, ` +
      `${duplicated} ya existían, ${unparsed} sin parsear, ${ignored} ignorados`
  );

  return {
    created,
    duplicated,
    unparsed,
    ignored,
    scanned: emails.length,
    since,
    skipped: duplicated + unparsed,
  };
};
