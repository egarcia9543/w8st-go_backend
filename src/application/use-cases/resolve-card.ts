import { CardKind } from "../../infrastructure/gmail/rules/types";
import prisma from "../../infrastructure/database/prisma";

// La identidad de un instrumento es [userId, last4, kind]: dos usuarios pueden
// tener una tarjeta terminada en los mismos 4 dígitos, y sin el userId el upsert
// engancharía los movimientos de uno a la tarjeta del otro.
export const resolverCard = async (
  userId: string,
  last4: string | null,
  kind: CardKind | null
): Promise<string | null> => {
  if (!last4 || !kind) return null;

  const card = await prisma.card.upsert({
    where: { userId_last4_kind: { userId, last4, kind } },
    update: {},
    create: { userId, last4, kind },
  });

  return card.id;
};
