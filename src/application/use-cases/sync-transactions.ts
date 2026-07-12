import { fetchBancolombiaEmails } from "../../infrastructure/gmail/gmail.service";
import { parseEmail } from "../../infrastructure/gmail/parser.service";
import prisma from "../../infrastructure/database/prisma";

export const syncTransactions = async () => {
  const emails = await fetchBancolombiaEmails();
  let created = 0;
  let skipped = 0;

  for (const email of emails) {
    const exists = await prisma.transaction.findUnique({
      where: { gmailMessageId: email.id },
    });

    if (exists) {
      skipped++;
      continue;
    }

    const parsed = parseEmail(email.payload);

    if (!parsed) {
      console.warn(`[sync] Correo ${email.id} no pudo ser parseado`);
      skipped++;
      continue;
    }

    await prisma.transaction.create({
      data: {
        gmailMessageId: email.id,
        ...parsed,
      },
    });

    created++;
  }

  console.log(`[sync] Completado: ${created} nuevas, ${skipped} omitidas`);
  return { created, skipped };
};
