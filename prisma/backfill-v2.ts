/**
 * Backfill de la migración 20260813120000_split_funding_source_and_cards.
 *
 * La migración añade las columnas con DEFAULT, así que no rompe nada al aplicarse,
 * pero deja todas las filas viejas como OUTFLOW + OWN_FUNDS y sin tarjeta.
 * Este script las reclasifica a partir del `paymentMethod` que ya tenían.
 *
 *   paymentMethod = 'tarjeta_credito' -> OUTFLOW + CREDIT     + Card(last4, CREDIT)
 *   paymentMethod = 'tarjeta_debito'  -> OUTFLOW + OWN_FUNDS  + Card(last4, DEBIT)
 *   paymentMethod = 'cuenta'          -> OUTFLOW + OWN_FUNDS  + Card(last4, ACCOUNT)
 *
 * Es idempotente: se puede correr varias veces. No toca filas con manualOverride.
 *
 * Uso:  npm run backfill:v2
 */
import "dotenv/config";
import { PrismaClient, CardKind, FundingSource } from "@prisma/client";

const prisma = new PrismaClient();

const MAPEO: Record<string, { kind: CardKind; fundingSource: FundingSource }> = {
  tarjeta_credito: { kind: "CREDIT", fundingSource: "CREDIT" },
  tarjeta_debito: { kind: "DEBIT", fundingSource: "OWN_FUNDS" },
  cuenta: { kind: "ACCOUNT", fundingSource: "OWN_FUNDS" },
};

const main = async () => {
  const transacciones = await prisma.transaction.findMany({
    where: { manualOverride: false },
    select: { id: true, paymentMethod: true, instrumentLast4: true, cardId: true },
  });

  console.log(`[backfill] ${transacciones.length} transacciones a revisar`);

  const cacheCards = new Map<string, string>();
  let actualizadas = 0;
  let sinMapeo = 0;

  for (const tx of transacciones) {
    const mapeo = tx.paymentMethod ? MAPEO[tx.paymentMethod] : undefined;

    if (!mapeo) {
      sinMapeo++;
      continue;
    }

    let cardId = tx.cardId;

    if (!cardId && tx.instrumentLast4) {
      const clave = `${tx.instrumentLast4}|${mapeo.kind}`;
      let existente = cacheCards.get(clave);

      if (!existente) {
        const card = await prisma.card.upsert({
          where: { last4_kind: { last4: tx.instrumentLast4, kind: mapeo.kind } },
          update: {},
          create: { last4: tx.instrumentLast4, kind: mapeo.kind },
        });
        existente = card.id;
        cacheCards.set(clave, existente);
      }

      cardId = existente;
    }

    await prisma.transaction.update({
      where: { id: tx.id },
      data: {
        direction: "OUTFLOW",
        fundingSource: mapeo.fundingSource,
        cardId,
      },
    });

    actualizadas++;
  }

  console.log(`[backfill] ${actualizadas} actualizadas, ${sinMapeo} sin paymentMethod reconocible`);
  console.log(`[backfill] ${cacheCards.size} tarjetas/cuentas detectadas`);

  const cards = await prisma.card.findMany({ orderBy: [{ kind: "asc" }, { last4: "asc" }] });
  for (const c of cards) {
    console.log(`  - ${c.kind.padEnd(7)} *${c.last4}${c.alias ? ` (${c.alias})` : ""}`);
  }
  console.log("\nPonles alias desde el front o con PATCH /cards/:id");
};

main()
  .catch((err) => {
    console.error("[backfill] Falló:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
