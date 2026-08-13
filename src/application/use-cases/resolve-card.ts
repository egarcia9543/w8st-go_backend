import { CardKind } from "../../infrastructure/gmail/rules/types";
import prisma from "../../infrastructure/database/prisma";

// last4 por sí solo no identifica un instrumento: puedes tener una débito y una
// crédito terminadas en los mismos 4 dígitos. La identidad es [last4, kind].
export const resolverCard = async (
  last4: string | null,
  kind: CardKind | null
): Promise<string | null> => {
  if (!last4 || !kind) return null;

  const card = await prisma.card.upsert({
    where: { last4_kind: { last4, kind } },
    update: {},
    create: { last4, kind },
  });

  return card.id;
};
