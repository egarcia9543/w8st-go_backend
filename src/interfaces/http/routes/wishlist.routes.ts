import { Router, Request, Response } from "express";
import prisma from "../../../infrastructure/database/prisma";
import { requireAuth } from "../middlewares/auth.middleware";
import { currentUserId } from "../current-user";
import { ensureWishlistTiers } from "../../../application/use-cases/ensure-wishlist-tiers";
import { moveItem, removeItem, Slot } from "../../../application/use-cases/wishlist-order";
import {
  WISHLIST_STATUSES,
  WishlistStatus,
  isWishlistStatus,
  parseItemInput,
  parseTierInput,
} from "../wishlist-input";

export const wishlistRouter = Router();

wishlistRouter.use(requireAuth);

type ItemRow = {
  id: string;
  tierId: string;
  name: string;
  price: number;
  currency: string;
  productUrl: string | null;
  imageUrl: string | null;
  notes: string | null;
  position: number;
  status: string;
  boughtAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const serializeItem = (item: ItemRow) => ({
  id: item.id,
  tierId: item.tierId,
  name: item.name,
  price: item.price,
  currency: item.currency,
  productUrl: item.productUrl,
  imageUrl: item.imageUrl,
  notes: item.notes,
  position: item.position,
  status: item.status,
  boughtAt: item.boughtAt,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

const wantedSlots = async (userId: string, tierIds: string[]): Promise<Slot[]> =>
  prisma.wishlistItem.findMany({
    where: { userId, status: "WANTED", tierId: { in: tierIds } },
    select: { id: true, tierId: true, position: true },
  });

const saveSlots = (changes: Slot[]) =>
  changes.map((slot) =>
    prisma.wishlistItem.update({
      where: { id: slot.id },
      data: { tierId: slot.tierId, position: slot.position },
    })
  );

const findOwnItem = (userId: string, id: string) =>
  prisma.wishlistItem.findFirst({ where: { id, userId } });

const findOwnTier = (userId: string, id: string) =>
  prisma.wishlistTier.findFirst({ where: { id, userId }, select: { id: true } });

wishlistRouter.get("/wishlist", async (req: Request, res: Response) => {
  const { status = "WANTED" } = req.query as { status?: string };

  if (!isWishlistStatus(status)) {
    return res
      .status(400)
      .json({ error: `\`status\` debe ser uno de: ${WISHLIST_STATUSES.join(", ")}.` });
  }

  const userId = currentUserId(req);
  await ensureWishlistTiers(userId);

  const [tiers, grouped] = await Promise.all([
    prisma.wishlistTier.findMany({
      where: { userId },
      orderBy: { position: "asc" },
      include: {
        items: {
          where: { status },
          orderBy: status === "WANTED" ? { position: "asc" } : { updatedAt: "desc" },
        },
      },
    }),
    prisma.wishlistItem.groupBy({ by: ["status"], where: { userId }, _count: { _all: true } }),
  ]);

  const counts = Object.fromEntries(WISHLIST_STATUSES.map((s) => [s, 0])) as Record<
    WishlistStatus,
    number
  >;
  for (const row of grouped) counts[row.status] = row._count._all;

  res.json({
    status,
    counts,
    tiers: tiers.map((tier) => ({
      id: tier.id,
      label: tier.label,
      color: tier.color,
      position: tier.position,
      items: tier.items.map(serializeItem),
    })),
  });
});

wishlistRouter.post("/wishlist/items", async (req: Request, res: Response) => {
  const parsed = parseItemInput(req.body, "create");
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });

  const userId = currentUserId(req);
  const tierId = (req.body ?? {}).tierId;

  if (typeof tierId !== "string" || !(await findOwnTier(userId, tierId))) {
    return res.status(400).json({ error: "`tierId` no corresponde a ningún tier." });
  }

  const position = await prisma.wishlistItem.count({
    where: { userId, tierId, status: "WANTED" },
  });

  const item = await prisma.wishlistItem.create({
    data: {
      userId,
      tierId,
      position,
      name: parsed.value.name!,
      price: parsed.value.price!,
      currency: parsed.value.currency ?? "COP",
      productUrl: parsed.value.productUrl ?? null,
      imageUrl: parsed.value.imageUrl ?? null,
      notes: parsed.value.notes ?? null,
    },
  });

  res.status(201).json(serializeItem(item));
});

wishlistRouter.patch("/wishlist/items/:id", async (req: Request, res: Response) => {
  const parsed = parseItemInput(req.body, "update");
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });

  const userId = currentUserId(req);
  const existing = await findOwnItem(userId, String(req.params.id));
  if (!existing) return res.status(404).json({ error: "Ítem no encontrado." });

  const { status, ...fields } = parsed.value;
  const statusChanges = status !== undefined && status !== existing.status;

  const leavesWanted = statusChanges && existing.status === "WANTED";
  const returnsToWanted = statusChanges && status === "WANTED";

  const reorder = leavesWanted
    ? removeItem(await wantedSlots(userId, [existing.tierId]), existing.id)
    : [];

  const position = returnsToWanted
    ? await prisma.wishlistItem.count({
        where: { userId, tierId: existing.tierId, status: "WANTED" },
      })
    : undefined;

  const [item] = await prisma.$transaction([
    prisma.wishlistItem.update({
      where: { id: existing.id },
      data: {
        ...fields,
        ...(statusChanges
          ? { status, boughtAt: status === "BOUGHT" ? new Date() : null }
          : {}),
        ...(position !== undefined ? { position } : {}),
      },
    }),
    ...saveSlots(reorder),
  ]);

  res.json(serializeItem(item));
});

wishlistRouter.put("/wishlist/items/:id/position", async (req: Request, res: Response) => {
  const { tierId, position } = (req.body ?? {}) as { tierId?: unknown; position?: unknown };

  if (typeof tierId !== "string") return res.status(400).json({ error: "`tierId` es obligatorio." });
  if (typeof position !== "number" || !Number.isInteger(position) || position < 0) {
    return res.status(400).json({ error: "`position` debe ser un entero mayor o igual a 0." });
  }

  const userId = currentUserId(req);
  const existing = await findOwnItem(userId, String(req.params.id));
  if (!existing) return res.status(404).json({ error: "Ítem no encontrado." });
  if (existing.status !== "WANTED") {
    return res.status(409).json({ error: "Solo se reordenan ítems pendientes." });
  }
  if (!(await findOwnTier(userId, tierId))) {
    return res.status(400).json({ error: "`tierId` no corresponde a ningún tier." });
  }

  const slots = await wantedSlots(userId, [...new Set([existing.tierId, tierId])]);
  await prisma.$transaction(saveSlots(moveItem(slots, existing.id, tierId, position)));

  res.status(204).end();
});

wishlistRouter.delete("/wishlist/items/:id", async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const existing = await findOwnItem(userId, String(req.params.id));
  if (!existing) return res.status(404).json({ error: "Ítem no encontrado." });

  const reorder =
    existing.status === "WANTED"
      ? removeItem(await wantedSlots(userId, [existing.tierId]), existing.id)
      : [];

  await prisma.$transaction([
    prisma.wishlistItem.delete({ where: { id: existing.id } }),
    ...saveSlots(reorder),
  ]);

  res.status(204).end();
});

wishlistRouter.patch("/wishlist/tiers/:id", async (req: Request, res: Response) => {
  const parsed = parseTierInput(req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });

  const userId = currentUserId(req);
  const id = String(req.params.id);
  if (!(await findOwnTier(userId, id))) return res.status(404).json({ error: "Tier no encontrado." });

  const tier = await prisma.wishlistTier.update({ where: { id }, data: parsed.value });

  res.json({ id: tier.id, label: tier.label, color: tier.color, position: tier.position });
});
